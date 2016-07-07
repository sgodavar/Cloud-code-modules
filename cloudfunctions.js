var bing = require('cloud/bing.com.js');

/* Make the Bing.com video search available on client side */
Parse.Cloud.define("searchBingVideos", function(request, response) {
  
    return bing.fetchBingVideoSearchResults(request.params.search).then(function(result) {
        response.success(result);
    },function(error) {
        response.error(error.message);
    });
    
});
