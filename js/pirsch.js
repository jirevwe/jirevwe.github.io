!function(){"use strict";if("1"!==navigator.doNotTrack){const e=document.querySelector("#pirschjs");var o=e.getAttribute("data-endpoint")||"https://api.pirsch.io/hit",n=e.getAttribute("data-code");if(e.getAttribute("data-dev")||!/^localhost(.*)$|^127(\.[0-9]{1,3}){3}$/is.test(location.hostname)&&"file:"!==location.protocol){if(history.pushState){const i=history.pushState;history.pushState=function(){i.apply(this,arguments),t()},window.addEventListener("popstate",t)}document.body?t():window.addEventListener("DOMContentLoaded",t)}else console.warn("You're running Pirsch on localhost. Hits will be ignored.")}function t(){var t=o+"?nc="+(new Date).getTime()+"&code="+n+"&url="+encodeURIComponent(location.href.substr(0,1800))+"&t="+encodeURIComponent(document.title)+"&ref="+encodeURIComponent(document.referrer)+"&w="+screen.width+"&h="+screen.height;const e=new XMLHttpRequest;e.open("GET",t),e.send()}}();