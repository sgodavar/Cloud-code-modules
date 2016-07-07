var sound_cloud_client_id = "057d11ceefcc302b9d16b4cbc68664b4";
var model = require('cloud/model.js');

 /** 
 * result from sound clould with some keyword
 * max result limit will be 3
 * http://api.soundcloud.com/tracks?client_id=057d11ceefcc302b9d16b4cbc68664b4&q=INSET_KEYWORD_HERE&limit=3
 */
exports.get_tracks_from_sound_cloud = function  get_tracks_from_sound_cloud (searchKeyword) {

    var client_id = sound_cloud_client_id;
    var request = new Parse.Promise();

    Parse.Cloud.httpRequest({
      url: 'http://api.soundcloud.com/tracks',
      method: 'GET',
      params: {
          client_id: client_id,
          q: searchKeyword,
          limit: 3
      },
      success: function(httpResponse) {
          var objectd         = JSON.parse(httpResponse.text);
          var tracks          = objectd;
          var saved_objects   = [];
          var limit_count     = 0;
          var i=0;
          if( objectd.length > 0 ) {
              tracks.forEach(function(v) {
                  var image_url       = v.artwork_url;
                  var title           = v.title;
                  var artistName      = "";//artist name is not available with sound cloud
                  var sourceNetwork   = "sound cloud";
                  var albumName       = "";//album name for sound cloud result not found
                  var songId          = v.id;
                  songId              = String(songId);
                  var errorCount      = 0;
                  var sourcePlayCount = v.playback_count;
                  sourcePlayCount     = parseInt(sourcePlayCount);
                  var sourceLikeCount = v.favoritings_count;
                  sourceLikeCount     = parseInt(sourceLikeCount);
                  var sourceDownloadCount = v.download_count;
                  sourceDownloadCount     = parseInt(sourceDownloadCount);
                  var ourUsersPlayCount = 0;
                  var duration        = v.duration;//duration is in seconds
                  duration            = parseInt(duration);
                  var ourUsersLikeCount = 0;
   
                  //create and save object for TrackSource
                  var trackSourceObject = new model.trackSourcesModel();
                  trackSourceObject.set('artworkURL', image_url);
                  trackSourceObject.set('title', title);
                  trackSourceObject.set('artistName', artistName);
                  trackSourceObject.set('sourceNetwork', sourceNetwork);
                  trackSourceObject.set('albumName', albumName);
                  trackSourceObject.set('songId', songId);
                  trackSourceObject.set('errorCount', errorCount);
                  trackSourceObject.set('sourcePlayCount', sourcePlayCount);
                  trackSourceObject.set('sourceLikeCount', sourceLikeCount);
                  trackSourceObject.set('sourceDownloadCount', sourceDownloadCount);
                  trackSourceObject.set('ourUsersPlayCount', ourUsersPlayCount);
                  trackSourceObject.set('duration', duration);
                  trackSourceObject.set('ourUsersLikeCount', ourUsersLikeCount);
                      
                  //trackSourceObject.save(null, {
                      //success: function(saveddd) {
                          saved_objects.push(trackSourceObject);
                          if( i == objectd.length-1 ) {
                              request.resolve(saved_objects);
                          }
                          i++;
                      
                      //},
                      //error: function(error) {
                        //  console.log("Some where error found."+JSON.stringify(error));
                          //if( i == objectd.length-1 ) {
                            //  request.resolve(saved_objects);
                          //}
                          //i++;
                          
                      //}
                  //});
              });
          } else {//no search found
              request.resolve(saved_objects);
          }
      },
      error: function(httpResponse) {
          console.log('Request failed with response code ' + httpResponse.status);
          request.resolve();
      }
    });
    return request;
}