var spreadsheet = require('cloud/google.spreadsheet.js');
var model = require('cloud/model.js');
var yt = require('cloud/youtube2.js');
var bing = require('cloud/bing.com.js');
var soundcloud = require('cloud/soundcloud.js');

/**
* Get the playlist spreadsheet from google docs and save
* playlist_url and remote_id in TrackPlaylist class.
* Delete playlists that are not anymore in the spreadsheet. 
* Check if Playlists are valid. Fetch name
* of each Playlist from Youtube API.
* Update playlists that already exist (set track_fetched
* to false).
*/
Parse.Cloud.job("youtube_fetch_playlists_in_spreadsheet",function(request,status){
    var controller = {
    
        googleSpreadSheetId: "1Fe0SxRH58l9xUElVfKrlqYyksR5ZrFUtWL_c2p-2pPs",
        creatorParseUserClassObjectId : "UAR0a2CvQV",
        
        
        /**
        * Run the Job
        */
        run: function() {
            return controller.getSpreadSheetTrackPlaylists().then(function(playlists) {
               return controller.deleteOldPlaylistsOnParse(playlists, "youtube").then(function() {
                    return controller.updatePlaylistsOnParse(playlists, "youtube");
               });
            });
        },
        
        /**
        * Get the playlist spreadsheet and save playlist_url 
        * and remote_id in TrackPlaylist model.
        *
        * Returns: 
        * {Parse.Promise} A promise that is fulfilled when the 
        * getSpreadSheetTrackPlaylists completes.
        * (trackPlaylistCollection) A collection with the
        * fetched playlists, dublicates removed
        */
        getSpreadSheetTrackPlaylists: function() {
        
            function arrayUnique(value, index, self) { 
                return self.indexOf(value) === index;
            }
        
            var trackPlaylists = new model.trackPlaylistCollection();
    
            return spreadsheet.fetchSpreadSheet(controller.googleSpreadSheetId)
            .then(function(sheetArray) {
                // No need for doublicate playlists, eliminate them right now
                var playlist_urls = sheetArray.map(function(arr) { return arr[10]; });
                var uniquePlaylists = playlist_urls.filter( arrayUnique );
               
                uniquePlaylists.forEach(function(url) {
    
                    var trackPlaylist = new model.trackPlaylistModel();
                    trackPlaylist.set('playlist_url', url);
                    trackPlaylist.set('remote_id', yt.getYTPlaylistIDFromYTPlaylistLink( url));
                    var trackPlaylistCollectionModel = new model.trackPlaylistCollectionModel();
                    trackPlaylistCollectionModel.set('trackPlaylist', trackPlaylist);
                    trackPlaylists.add(trackPlaylistCollectionModel);

                });
                
                return trackPlaylists;
        
            });
    
        },
        
        /**
        * Delete playlists on parse if they are not
        * in the newTrackPlaylists.
        *
        * Parameters: 
        * (trackPlaylistCollection) newTrackPlaylists
        * - a collection with the new playlists
        * (String) sourceNetwork
        * - the source network to search for on parse
        * 
        * Returns:
        * {Parse.Promise} A promise that is fulfilled when the 
        * deleteOldPlaylistsOnParse completes.
        */
        deleteOldPlaylistsOnParse: function(newTrackPlaylists, sourceNetwork) {
            var query = new Parse.Query("TrackPlaylist");
            query.equalTo("source_network", sourceNetwork);
            query.limit(1000);
                
            var collection = query.collection();
            
            return collection.fetch().then(function(collection) {
                
                var promisesParallel = [];
                
                // If a playlist_url is not in the spreadsheet
                // delete it from parse
                collection.each(function(trackPlaylist){
                    var exists = false;
                    newTrackPlaylists.each(function(newTrackPlaylist){
                        if(trackPlaylist.get('playlist_url') == newTrackPlaylist.get('trackPlaylist').get('playlist_url')){
                            exists = true;
                        }
                    });
                    if(exists == false){
                        promisesParallel.push(trackPlaylist.destroy());
                    }
                    
                });
                return Parse.Promise.when(promisesParallel);
    
            });
    
        },
        
        /**
        * Check if Playlists are valid. Fetch name
        * of each Playlist from Youtube API.
        * 
        * For valid Playlists:
        * Save them on Parse or set track_fetched to
        * false if they already exist on parse.
        * 
        * Parameters: 
        * (trackPlaylistCollection) newTrackPlaylists
        * - a collection with the new playlists
        * (String) sourceNetwork
        * - the source network to search for on parse
        * 
        * Returns:
        * {Parse.Promise} A promise that is fulfilled when the 
        * updatePlaylistsOnParse completes.
        */
        updatePlaylistsOnParse: function(newTrackPlaylists, sourceNetwork) {
            
            var promisesParallel = [];
            
            newTrackPlaylists.each(function(newTrackPlaylist){

                promisesParallel.push(  yt.getPlaylistInfoFromYoutube(newTrackPlaylist.get('trackPlaylist').get('playlist_url')).then(function(playListInfo) {

                    var query = new Parse.Query("TrackPlaylist");
                    query.equalTo("playlist_url", newTrackPlaylist.get('trackPlaylist').get("playlist_url"));
                    
                    // save the playlist only if the playListInfo
                    // title was retrieved. Otherwise the playlist 
                    // url was not a valid playlist.
                    if(playListInfo.items[0]){
        
                        return query.first().then(function(object){
                            if(!object)
                                object = newTrackPlaylist.get('trackPlaylist');
                            else
                                object.set('track_fetched', false);
                            
                            object.set('name', playListInfo.items[0].snippet.title);
                            
                            var creatorClass = Parse.Object.extend("User");
                            var creator = new creatorClass();
                            creator.id = controller.creatorParseUserClassObjectId;
                            object.set('creator', creator);

                            return object.save();
    
                        });
                        
                    //The playlist is not valid, remove it from Parse 
                    //TrackPlaylist class if it exists
                    } else {
                        
                        return query.first().then(function(object){
                            var promise = new Parse.Promise();
                            
                            if(object)
                                promise = object.destroy();
                            else
                                promise = Parse.Promise.as();
                                
                            newTrackPlaylists.remove(newTrackPlaylist);
                
                            return promise;
    
                        });
                        
                    }
                
                }));

            });
            
            return Parse.Promise.when(promisesParallel);
        },
    
    };      
    
    controller.run().then(function(playlists) {
        status.success('Job youtube_fetch_playlists_in_spreadsheet done');
    });
});


/**
 * Get one playlist from TrackPlaylist class whoes tracks are not already fetched
 * Fetch the tracks for this playlist from youtube API
 * For each track get bing video search results and save them in parse TrackSource class
 * Save each track with bing search results objectIds in parse Track class
 * Save the image of the first track in the playlist artwortURL field and set the track_fetched field to true
 * 
 * Run this job i.e. every 2 minutes in the free parse plan.
 * If your parse plan allows more than one job you have to make sure
 * that only one instance of this job is running at time i.e. run it
 * every 10 min.
 */
Parse.Cloud.job("youtube_fetch_playlist_tracks",function(request,status){

    var controller = {
        playlist: null,
        
        /**
        * Run the Job
        */
        run: function() {
            return controller.getPlaylistToFetch("Youtube").then(function(object){
                
                if(!object){//No more Playlists to fetch
                
                    return Parse.Promise.as("Nothing to do");
                
                }else{//There is a playlist to fetch
                    controller.playlist = object;
                    status.message("Fetching Playlist " + object.get("remote_id"));
                    console.log("Fetching Playlist " + object.get("remote_id"));
                    return yt.fetchPlaylistFromYoutube(object.get('playlist_url'), null, null).then(function(trackArray) {
                        if(trackArray)
                            if(trackArray.items[0].snippet.thumbnails)
                                object.set('artworkURL', trackArray.items[0].snippet.thumbnails.default.url);

                        return controller.savePlaylistTracksOnParse(trackArray);
                        
                    },function(error) {
                        return Parse.Promise.error(error);
                    }).then(function() {
                            
                        object.set('track_fetched', true);
                        return object.save();
                        
                    },function(error) {
                        return Parse.Promise.error(error);
                    }).then(function() {
                        return Parse.Promise.as("Done: " + object.get("remote_id"));
                    });
                
                }
                
            },function(error) {
                return Parse.Promise.error(error);
            });
            
        },
        
        
        /**
        * Get a playlist from TrackPlaylist class
        * whoes tracks are not already fetched.
        *
        * Parameters: 
        * (String) sourceNetwork
        * - the source network to search for on parse
        * 
        * Returns:
        * {Parse.Promise} A promise that is fulfilled when the 
        * getPlaylistToFetch completes.
        */
        getPlaylistToFetch: function(sourceNetwork) {
    
            var query = new Parse.Query("TrackPlaylist");
            query.equalTo("source_network", sourceNetwork);
            query.equalTo("track_fetched", false);

            return query.first().then(function(object){
                if(!object)
                    return;
                else
                    return object;
            
            });
        
        },
        

        /**
        * Check if a track with remote_id exists on
        * parse.
        * 
        * Parameters: 
        * (String) remote_id
        * 
        * Returns:
        * {Parse.Promise} A promise that is fulfilled when the 
        * existingTrack completes.
        */
        existingTrack: function(remote_id) {
            var query = new Parse.Query("Track");
            query.equalTo("remote_id", remote_id);
            return query.first();
        },
        existingTrackToTrackPlaylistMap: function(track, trackplaylist) {
            var query = new Parse.Query("TrackToTrackPlaylistMap");
            query.equalTo("track_id", track);
            query.equalTo("track_playlist_id", trackplaylist);
            return query.first();
        },
        
        /**
        * Delay for delayTime milliseconds
        * 
        * Parameters: 
        * (Number) delayTime in milliseconds
        * 
        * Returns:
        * {Parse.Promise} A promise that is fulfilled when the 
        * delay completes.
        */
        delay: function(delayTime) {
            var delayUntil;
            var delayPromise;

            var _delay = function () {
                if (Date.now() >= delayUntil) {
                    delayPromise.resolve();
                    return;
                } else {
                    process.nextTick(_delay);
                }
            }
            
            delayUntil = Date.now() + delayTime;
            delayPromise = new Parse.Promise();
            _delay();
            return delayPromise;
        },
        
        //remove duplicates in a multidimensional
        //array if all fields are the same.
        unique: function(items, key) {
            var set = {};
            
            return items.filter(function(item) {
                var k = key ? key.apply(item) : item;
                return k in set ? false : set[k] = true;
            })
        },
        
        /**
        * For each track fetch bing and and soundcloud 
        * and save/update the results in TrackSource class.
        * Save/update the tracks in Track class
        *
        * Parameters: 
        * (Array) trackArray
        * - an array with the youtube PlaylistItems
        *
        * Returns:
        * {Parse.Promise} A promise that is fulfilled when the 
        * delay completes.
        */
        savePlaylistTracksOnParse: function(trackArray) {
        
            var promisesParallel = [];

            trackArray.items.forEach( function(trackItem, ind) {
                var track;
                var trackSourceids = new Array();
                //if(ind < 3)
                promisesParallel.push(  controller.existingTrack(trackItem.snippet.resourceId.videoId).then(function(object) {

                    if(!object){
                        track = new model.trackModel();
                        track.set('name', trackItem.snippet.title);
                        track.set('remote_id', trackItem.snippet.resourceId.videoId);
                    }else{ //track already exists on parse
                        track = object;
                        track.set('name', trackItem.snippet.title);

                        trackSourceids[0] = track.get('youTubeRef1');
                        trackSourceids[1] = track.get('youTubeRef2');
                        trackSourceids[2] = track.get('youTubeRef3');
                        
                        trackSourceids[3] = track.get('soundCloudRef1');
                        trackSourceids[4] = track.get('soundCloudRef2');
                        trackSourceids[5] = track.get('soundCloudRef3');
                    }
                    
                }).then(function() {
                    return bing.fetchBingVideoSearchResults(trackItem.snippet.title).then(function(bingSearchResults) {
                       // console.log("length: " + bingSearchResults.length);
                        var promise = Parse.Promise.as();
                        var index = 1;
                        
                        //put the track into first index of bing search
                        //result array and make sure the array has only
                        //unique and max 3 elements
                        var tmparr = [];
                        tmparr[0] = "https://www.youtube.com/watch?v=" + trackItem.snippet.resourceId.videoId;
                        tmparr[1] = trackItem.snippet.title;
                        bingSearchResults.splice(0, 0, tmparr);
                        bingSearchResults = controller.unique(bingSearchResults, [].join);
                        bingSearchResults.length = 3;
                        
                        bingSearchResults.forEach( function(bingSearchResult) {
                            if(bingSearchResult[0])//Debug - do not save empty results in production env.
                                promise = promise.then(function() {

                                    var trackSource = new model.trackSourcesModel();
                                    if(trackSourceids[index-1] != null){
                                        trackSource.id = trackSourceids[index-1].id;
                                    }
                                    trackSource.set('sourceNetwork', "Youtube");
                                    trackSource.set('errorCount', 0);
                                    trackSource.set('ourUserLikeCount', 0);
                                    trackSource.set('title', bingSearchResult[1]); //Video Title
                                    trackSource.set('songId', yt.getYTVideoIDFromYTVideoLink(bingSearchResult[0])); // Track ID from video link
           
                                    return yt.getVideoDetailsFromYoutube(bingSearchResult[0], "snippet,contentDetails,statistics").then(function(ytArr){
                                        
                                        if(ytArr.items[0]){
                                            trackSource.set('duration', controller.secondsFromIsoDuration(ytArr.items[0].contentDetails.duration));
                                            trackSource.set('sourceLikeCount', parseInt(ytArr.items[0].statistics.likeCount));
                                            trackSource.set('sourcePlayCount', parseInt(ytArr.items[0].statistics.viewCount));
                                            trackSource.set('artworkURL', ytArr.items[0].snippet.thumbnails.default.url);
                                        }
                                        
                                        return trackSource;
                                        
                                    },function(error) {//youtube api error, save the tracksource infos we have
                                        console.log("youtube api error");
                                        return Parse.Promise.as(trackSource);
                                    }).then(function(trackSource){ return trackSource.save();}).then(function(trackSource){
                                            
                                        track.set('youTubeRef'+index,trackSource );
                                        index++;
                                    });

                                }).then(function() {
                                    controller.delay(trackArray.items.length-50);
                                    //controller.delay(200);
                                },function(error) {
                                    console.log("error delay");
                                    return Parse.Promise.error(error);
                                });  //prevent request limit exceedings
                        
                        });
                        
                        // delete youTubeRef tthat are not found anymore
                        promise = promise.then(function() {
                            while(index<4){
                                track.unset('youTubeRef' + index);
                                index++;
                            }
                        },function(error) {
                            console.log("error unset youtuberef");
                            return Parse.Promise.error(error);
                        });
                        
                        return promise;
                    
                    }).then(function() {
                        return soundcloud.get_tracks_from_sound_cloud(trackItem.snippet.title).then(function(res) {
                            var promise = Parse.Promise.as();
                            if(res){
                                res.forEach( function(resItem, index) {
                                    if(trackSourceids[index+3] != null){
                                        resItem.id = trackSourceids[index+3].id;
                                    }
                                    promise = promise.then(function() {
                                        return resItem.save();
                                    }).then(function() {
                                        controller.delay(trackArray.items.length-50);
                                    });
                                    track.set('soundCloudRef'+(index+1),resItem );
                                });
                            }
                            return promise;
                        },function(error) {
                            console.log("error soundcloud fetch");
                            return Parse.Promise.error(error);
                    }); 
                            
                    }).then(function() {
                    
                        return track.save().then(function(newTrack){
                            return controller.existingTrackToTrackPlaylistMap(newTrack, controller.playlist).then(function(object) {
                                if(!object){
                                    var trackToTrackPlaylist = Parse.Object.extend("TrackToTrackPlaylistMap");
                                    var map = new trackToTrackPlaylist();
        
                                    map.set('track_id', newTrack);
                                    map.set('track_playlist_id', controller.playlist);
                                    return map.save();
                                }
                            });
                        },function(error) {
                            console.log("error track save:" + error.message);
                            return Parse.Promise.error(error);
                        });
                            
                    },function(error) {
                        console.log("error after track save");
                        return Parse.Promise.error(error);
                    }); 
    
                },function(error) {
                    console.log("error fetch bing and soundcloud");
                    return Parse.Promise.error(error);
                }));

            });
            
            return Parse.Promise.when(promisesParallel).then(function(){},function(error) {
                console.log("error paralell");
                var i = error.length-1;
                while(!error[i]){
                    i--;
                }
                
                return Parse.Promise.error(error[i]);
                
            });
            
        },
        
        
        /**
        * Return seconds of a ISO duration String
        * This is needed to translate youtube duration strings
        */
        secondsFromIsoDuration: function(duration) {
            var regex = /P((([0-9]*\.?[0-9]*)Y)?(([0-9]*\.?[0-9]*)M)?(([0-9]*\.?[0-9]*)W)?(([0-9]*\.?[0-9]*)D)?)?(T(([0-9]*\.?[0-9]*)H)?(([0-9]*\.?[0-9]*)M)?(([0-9]*\.?[0-9]*)S)?)?/
            var matches = duration.match(regex);
            var hours = parseFloat(matches[12]) || 0;
            var minutes = parseFloat(matches[14]) || 0;
            var seconds = parseFloat(matches[16]) || 0;

            return hours*3600 + minutes*60 + seconds;
        }
      
    };
    
    controller.run().then(function(message) {
        status.success(message);
    },function(error) {
        status.error( error.message);
    });
    
});