// FirstPromoter tracking script
(function(w){
  w.fpr = w.fpr || function(){
    w.fpr.q = w.fpr.q || [];
    w.fpr.q[arguments[0] == 'set' ? 'unshift' : 'push'](arguments);
  };
})(window);

// Initialize FirstPromoter with your client ID
fpr("init", {cid: "z8op3lgw"}); 
fpr("click");
