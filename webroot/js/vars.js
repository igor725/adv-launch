// Why not?
window.on = window.addEventListener;
window.off = window.removeEventListener;
window.$ = qs => document.querySelector(qs);
window.$$ = qs => document.querySelectorAll(qs);
Element.prototype.on = Element.prototype.addEventListener;
Element.prototype.off = Element.prototype.removeEventListener;
Element.prototype.$ = Element.prototype.querySelector;
Element.prototype.$$ = Element.prototype.querySelectorAll;
