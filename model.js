// Track Class Model
// -----------------
/* Tracks found in a playlist, fetched from Youtube.
 * Each track has 3 pointers to trackSourcesModel
 * found with a bing.com search (with track name)
 * 
 * Fields:
 * -------
 * objectId
 * albumName
 * artistName
 * name
 * remote_id
 * youTubeRef1
 * youTubeRef2
 * youTubeRef3
 *
 */
exports.trackModel = Parse.Object.extend("Track", {
});

// TrackSources Class Model
// ------------------------
/* Results from bing.com search (with track name)
 * Each trackModel has 3 pointers to TrackSources objects
 *
 * Fields:
 * -------
 * objectId
 * duration
 * artistName
 * artworkURL
 * duration
 * errorCount
 * ourUserLikeCount
 * songID
 * sourceLikeCound
 * sourceNetwork
 * sourcePlayCount
 * title
 *
 */
exports.trackSourcesModel = Parse.Object.extend("TrackSource", {

    defaults : function() {
        return {
            errorCount : 0,
            ourUserLikeCount : 0,
        };
    }

});

// TrackPlaylist Class Model
// -------------------------
/* TrackPlaylist that are found in the spreadsheet
 */
exports.trackPlaylistModel = Parse.Object.extend("TrackPlaylist", {

    defaults : function() {
        return {
            //creator : UAR0a2CvQV, //create pointer here
            isCreatedByBot : true,
            isPrivate : false,
            numFollowers : 0,
            playCount : 0,
            source_network : "Youtube",
            track_fetched : false
        };
    }
});

// TrackPlaylistCollection Model
// -----------------------------
/* A Model for a Collection of trackPlaylists
 */
exports.trackPlaylistCollectionModel = Parse.Object.extend("", {

});

// TrackPlaylist Collection
// ------------------------
/* A Collection of trackPlaylistModel
 */
exports.trackPlaylistCollection = Parse.Collection.extend({
    model: exports.trackPlaylistCollectionModel
});