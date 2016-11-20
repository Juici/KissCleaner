// ==UserScript==
// @name        KissCleaner
// @namespace   juici.github.io
// @description Cleans up KissAnime pages. Tested to work with Firefox and Greasemonkey.
// @author      Juici, crapier
// @include     https://kissanime.to/*
// @include     http://kissanime.to/*
// @include     https://kisscartoon.me/*
// @include     http://kisscartoon.me/*
// @include     https://kissasian.com/*
// @include     http://kissasian.com/*
// @version     4.0
// @downloadURL https://juici.github.io/KissCleaner/kisscleaner.user.js
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_registerMenuCommand
// @grant       GM_getResourceText
// @grant       GM_addStyle
// @grant       unsafeWindow
// @resource    settings https://juici.github.io/KissCleaner/settings.html
// @resource    css https://juici.github.io/KissCleaner/style.css
// @resource    resizeVideo https://juici.github.io/KissCleaner/resize-video.css
// @noframes
// ==/UserScript==

// current page url
let url = window.location.href;
// regex to check against for determining what type page currently on and what to clean
const rHome = /https?:\/\/(kiss(?:anime\.to|cartoon\.me|asian\.com))\/$/;
const rAnimeList = /https?:\/\/(kiss(?:anime\.to|cartoon\.me|asian\.com))\/(AnimeList|Genre|Status|Search|UpcomingAnime|CartoonList|DramaList|Country)/;
const rAnimePage = /https?:\/\/(kiss(?:anime\.to|cartoon\.me|asian\.com))\/(Anime|Cartoon|Drama)\/[^\/]*$/;
const rVideoPage = /https?:\/\/(kiss(?:anime\.to|cartoon\.me|asian\.com))\/(Anime|Cartoon|Drama)\/[^\/]*\/[^\/]*(?:\?id=\d*)?/;

// pre init checks
if (document.querySelector('.cf-browser-verification')) {
  // cloudflare browser verification
  console.log('Waiting for CloudFlare browser verification.');
  return;
} else if (document.getElementById('containerRoot') == null) {
  // some error with page
  console.log('Something went wrong loading page. Reloading to fix it...');
  window.location.href = window.location.href;
  return;
}

// player type constants
const PLAYER = {
  FLASH: 'Flash',
  HTML5: 'HTML5'
};

// site type
const SITE = {
  ANIME: false,
  CARTOON: false,
  ASIAN: false
};
const kissSite = /:\/\/kiss([^.]+)\./.exec(window.location.href)[1].toUpperCase();
SITE[kissSite] = true;

// settings
const settings = {
  // auto pause on video load
  autoPause: GM_getValue('autoPause', false),
  // auto advance to next video on playback end
  autoAdvance: GM_getValue('autoAdvance', true),
  // auto scroll to video area
  autoScroll: GM_getValue('autoScroll', true),

  // resize the video
  resizeVideo: GM_getValue('resizeVideo', true),

  // remove login
  removeLogin: GM_getValue('removeLogin', true),
  // remove comments area
  removeComments: GM_getValue('removeComments', true),

  // video player
  player: GM_getValue('player', PLAYER.HTML5),
  // video quality
  quality: GM_getValue('quality', '1080'),
  // video volume
  volume: GM_getValue('volume', 100)
};

const _ = {
  // document query returning array
  queryAll: function (...selector) {
    return Array.from(document.querySelectorAll(selector instanceof Array ? selector.join(',') : selector));
  },
  // remove element matching css selector (first or index)
  removeAd: function (selector, index) {
    let ads = _.queryAll(selector);

    // make sure index is within bounds
    index = index || 0;
    if (index < 0 || index > ads.length - 1) {
      index = 0;
    }

    ads[index].remove();
  },
  // remove all elements matching css selectors
  removeAds: function (...selectors) {
    let ads = _.queryAll(selectors);
    ads.forEach(elt => elt.remove());
  },
  // clean up the empty space left by ad removal
  cleanupAdspace: function () {
    // get the ads frame
    let adspace = document.getElementById('adsIfrme1');
    if (adspace) {
      // check and remove the clear before the adspace
      let clearBefore = adspace.parentElement.previousElementSibling;
      if (clearBefore && clearBefore.matches('.clear')) {
        clearBefore.remove();
      }
      // check and remove the clear a bit after the adspace
      let clearAfter = adspace.parentElement.nextElementSibling && adspace.parentElement.nextElementSibling.nextElementSibling &&
        adspace.parentElement.nextElementSibling.nextElementSibling.nextElementSibling ? adspace.parentElement.nextElementSibling.nextElementSibling.nextElementSibling : null;
      if (clearAfter && clearAfter.matches('.clear')) {
        clearAfter.remove();
      }
      // remove the adspace's parent (and thus it)
      adspace.parentElement.remove();
    }
  },
  // remove or hide stubborn ads
  hideAds: function () {
    let count = 0;
    let adremover = setInterval(() => {
      count++;

      // remove extra elements after #containerRoot in body
      let body = document.body;
      for (let i = body.children.length - 1; !body.children[i].matches('#containerRoot'); i--) {
        body.children[i].remove();
      }

      // hide elements after #container in #containerRoot
      let container = document.getElementById('containerRoot');
      for (let i = container.children.length - 1; !container.children[i].matches('#container'); i--) {
        _.hideElement(container.children[i], true);
      }

      // hide elements in the #rightside that aren't content
      let rightsideDivs = _.queryAll('#rightside > div:not(.rightBox):not(.clear):not(.clear2)');
      rightsideDivs.forEach(elt => _.hideElement(elt, true));

      if (count === 50) {
        clearInterval(adremover);
      }
    }, 100);
  },
  // inject javascript into page
  injectScript: function (js) {
    // create script to inject
    let script = document.createElement('script');
    script.type = 'text/javascript';
    script.innerHTML = (typeof js === 'function' ? `(${js.toString()})();` : js);
    // inject the script
    document.head.appendChild(script);
  },
  // hide an element, soft param doesn't use 'display: none;' instead 'visibility: hidden; height: 0; width: 0;'
  hideElement: function (element, soft) {
    if (soft === true) {
      element.style.setProperty('visibility', 'hidden', 'important');
      element.style.setProperty('height', '0', 'important');
      element.style.setProperty('width', '0', 'important');
    } else {
      element.style.setProperty('display', 'none', 'important');
    }
  },
  // navigate to previous video
  previousVideo: function () {
    let btnPrevious = document.getElementById('btnPrevious');
    if (btnPrevious) {
      window.location.href = btnPrevious.parentElement.href;
    }
  },
  // navigate to next video
  nextVideo: function () {
    let btnNext = document.getElementById('btnNext');
    if (btnNext) {
      window.location.href = btnNext.parentElement.href;
    }
  },
  // check if should advance to next video
  checkAutoAdvance: function (state) {
    state == 0 && settings.checkAutoAdvance && _.nextVideo();
  }
};

console.log('Initializing KissCleaner...');

// add custom css
GM_addStyle(GM_getResourceText('css'));

//---------------------------------------------------------------------------------------------------------------
// Clean Home page
//---------------------------------------------------------------------------------------------------------------
if (rHome.test(url)) {
  console.log('Cleaning home page...');

  // remove sections from the right side of the page
  let rightsideSearch = [/remove ads/i, /like me please/i];
  let rightside = document.getElementById('rightside');
  if (rightside) {
    for (let i = rightside.children.length - 1; i >= 0; i--) {
      let child = rightside.children[i];
      // if child has children
      if (child.children.length > 0) {
        // check search patterns
        let remove = false;
        for (let pattern of rightsideSearch) {
          if (child.children[0].textContent.search(pattern) > 0) {
            remove = true;
            break;
          }
        }

        // remove because a pattern matched and remove following .clear2 (if exists)
        if (remove) {
          let clear2 = child.nextElementSibling;
          if (clear2 && clear2.matches('.clear2')) {
            clear2.remove();
          }
          child.remove();
        }
      }
    }
  }

  // remove register link in nav sub bar
  let navsub = document.querySelector('#navsubbar > p');
  if (navsub) {
    navsub.children[0].remove();
    navsub.childNodes[1].remove();
  }

  // remove ads
  _.removeAds('#divFloatLeft', '#divFloatRight', '#divAds2', '#divAds', '#adsIfrme1');

  // remove or hide stubborn ads
  _.hideAds();

  console.log('Finished cleaning home page.');
}

//---------------------------------------------------------------------------------------------------------------
// Clean Anime List Pages
//---------------------------------------------------------------------------------------------------------------
if (rAnimeList.test(url)) {
  console.log('Cleaning anime list page...');

  // remove large spaces left by empty adspace
  _.cleanupAdspace();

  // remove ads
  _.removeAds('#divFloatLeft', '#divFloatRight', '#adsIfrme2');

  // remove or hide stubborn ads
  _.hideAds();

  console.log('Finished cleaning anime list page.');
}

//---------------------------------------------------------------------------------------------------------------
// Clean Episode List Pages
//---------------------------------------------------------------------------------------------------------------
if (rAnimePage.test(url)) {
  console.log('Cleaning episode list page...');

  // remove large spaces left by empty adspace
  _.cleanupAdspace();

  // remove ads
  // remove bookmarks
  _.removeAds('#divFloatLeft', '#divFloatRight', '#divAds', '#spanBookmark');

  // remove fluff from episode list pages
  let eplist = document.querySelector('div.barContent.episodeList > div:not(.arrow-general)');
  if (eplist) {
    let countdown = document.querySelector('#nextEpisodeCountDown');
    if (countdown) {
      countdown = countdown.parentElement.parentElement;

      // remove clear before listing
      let clear = countdown.nextElementSibling;
      if (clear && clear.matches('.clear')) {
        clear.remove();
      }
    }

    // loop remove element if not listing or element containing counting
    let child;
    while (eplist.children.length > 0 && !((child = eplist.children[0]).matches('.listing') || (countdown != null && child == countdown))) {
      child.remove();
    }
  }

  // remove comments (different child location for kissasian)
  settings.removeComments && _.removeAd('div.bigBarContainer', SITE.ASIAN ? 3 : 2);

  // remove or hide stubborn ads
  _.hideAds();

  console.log('Finished cleaning episode list page.');
}

//---------------------------------------------------------------------------------------------------------------
// Clean Video Page
//---------------------------------------------------------------------------------------------------------------
if (rVideoPage.test(url)) {
  console.log('Cleaning video page...');

  // override functions so they wont be do anything when called by the pages code
  _.injectScript('(function () { DoDetect2 = CheckAdImage = function () {}; })();');
  console.log('Overridden anti-adblock detects.');

  // remove ad spaces
  // remove lights off feature (pointless with ads removed)
  _.removeAds('#divFloatLeft', '#divFloatRight', '#adsIfrme6', '#adsIfrme7', '#adsIfrme8', '#adsIfrme10', '#adsIfrme11', '#adCheck1', '#adCheck2', '#adCheck3', '#divDownload', '#divFileName', '#switch', '#divTextQua');

  // remove empty spaces from video pages
  // remove clears
  let vid = document.getElementById('centerDivVideo'),
      vidParent = vid.parentElement;
  for (let i = 0; i < vidParent.children.length; i++) {
    if (vidParent.children[i].matches('.clear, .clear2')) {
      vidParent.removeChild(vidParent.children[i--]);
    }
  }

  // remove comments area
  if (settings.removeComments) {
    // get the comment section on the video pages
    let comments = document.getElementById('btnShowComments');
    comments = (comments ? comments.parentElement : document.getElementById('divComments'));
    // remove comments and elements just prior
    if (comments) {
      let temp;
      while ((temp = comments.previousElementSibling) && !temp.matches('iframe, script')) {
        temp.remove();
      }
      while ((temp = comments.nextElementSibling) && !temp.matches('iframe, script')) {
        temp.remove();
      }
      comments.remove();
    }
  }

  if (settings.resizeVideo) {
    GM_addStyle(GM_getResourceText('resizeVideo'));
  }

  // hide on page video controls
  let selectPlayer = document.getElementById('selectPlayer');
  if (selectPlayer) {
    _.hideElement(selectPlayer.parentElement.parentElement.parentElement);
  }

  // remove info above video
  let profileLink = document.querySelector('#adsIfrme a[href="/Profile"]');
  if (profileLink) {
    profileLink.parentElement.parentElement.remove();
  }

  // set player type
  let useFlash = (settings.player === PLAYER.FLASH),
      youtubeFlash = false;

  // set player cookie and reload with correct player
  if (useFlash && document.cookie.indexOf('usingFlashV1') < 0) {
    document.cookie = 'usingFlashV1=true;path=/';
    document.cookie = 'usingHTML5V1=; expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/';
    window.location.href = window.location.href;
  } else if (document.cookie.indexOf('usingHTML5V1') < 0) {
    document.cookie = 'usingFlashV1=; expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/';
    document.cookie = 'usingHTML5V1=true;path=/';
    window.location.href = window.location.href;
  }

  if ((useFlash && unsafeWindow.jwplayer == null) || (!useFlash && unsafeWindow.myPlayer == null)) {
    useFlash = !useFlash;
    youtubeFlash = (unsafeWindow.jwplayer == null && unsafeWindow.myPlayer == null);
  }

  // start per player settings
  // flash player
  if (useFlash) {
    console.log('Using Flash player.');

    if (youtubeFlash) {
      console.log('Using YouTube player.');

      // functions to inject on page for flash video control
      // fires when youtube player is ready
      let ytHook = (playerId) => {
        console.log('Youtube player hooked.');
        settings.autoPause && embedVideo.pauseVideo();
        embedVideo.addEventListener('onStateChange', _.checkAutoAdvance);

        // translate option into youtube quality strings values
        let ytQuality = (quality) => {
          switch (quality) {
            case '360': return 'medium';
            case '480': return 'large';
            case '720': return 'hd720';
            default: return 'hd1080';
          }
        };

        // set quality
        embedVideo.setPlaybackQuality(ytQuality(settings.quality));
        // set volume
        embedVideo.setVolume(settings.volume);

        // focus on the video (so pressing f will fullscreen)
        setTimeout(() => { embedVideo.focus(); }, 0);

        // force position to be absolute (compatibility with 'Turn Off the Lights')
        setTimeout(() => { embedVideo.style.position === 'relative' && embedVideo.style.removeProperty('position'); }, 100);
      };
      // inject function into page
      unsafeWindow.onYouTubePlayerReady = exportFunction(ytHook, unsafeWindow);
    } else {
      console.log('Using jwplayer.');
      // functions to inject on page for flash video control
      // fires when youtube player is ready
      let jwHook = () => {
        // wait till video is loaded into player
        jwplayer().onReady(() => {
          console.log('jwplayer hooked.');
          // change the quality to desired flash option
          let qualityLevels = jwplayer().getQualityLevels(),
              qualitySet = false,
              desiredQuality = parseInt(settings.quality, 10);

          // try to find exact quality level
          for (let i = 0; i < qualityLevels.length; i++) {
            if (desiredQuality === parseInt(qualityLevels[i].label, 10)) {
              jwplayer().setCurrentQuality(i);
              qualitySet = true;
              break;
            }
          }

          // try to find best level alternate
          if (!qualitySet) {
            // check if desired level is lower than all available
            if (desiredQuality < parseInt(qualityLevels[0].label, 10)) {
              jwplayer().setCurrentQuality(0);
            }
            // check if desired level is higher than all available
            else if (desiredQuality > parseInt(qualityLevels[qualityLevels.length - 1].label, 10)) {
              jwplayer().setCurrentQuality(qualityLevels.length - 1);
            }
            // else find level that is next smallest
            else {
              for (let i = 0; i < qualityLevels.length; i++) {
                if (desiredQuality < parseInt(qualityLevels[i].label, 10)) {
                  jwplayer().setCurrentQuality(i - 1);
                  break;
                }
              }
            }
          }

          // pause the video if option is enabled
          settings.autoPause && jwplayer().pause();

          // setup callback for end of video checks
          jwplayer().onComplete(_.checkAutoAdvance);
        });
      };
      // inject function into page
      unsafeWindow.jwHook = exportFunction(jwHook, unsafeWindow);
      // call injected function, hopefully after jwplayer has been setup
      setTimeout(() => { unsafeWindow.jwHook(); }, 500);
    }

  }
  // html5 player
  else {
    console.log('Using HTML5 player.');

    // move quality select below player
    let selectQuality = document.getElementById('selectQuality'),
        videoArea = document.getElementById('centerDivVideo');
    if (selectQuality && videoArea) {
      let parent = selectQuality.parentElement;
      videoArea.parentElement.appendChild(document.createElement('div'), videoArea.nextSibling);
      videoArea.parentElement.appendChild(selectQuality, videoArea.nextSibling);
      parent.remove();
    }

    // functions to inject on page for html5 video control
    let html5Hook = () => {
      console.log('HTML5 player hooked.');
      // change the quality to desired flash option
      let qualityLevels = document.querySelector('#selectQuality'),
          qualitySet = false,
          desiredQuality = parseInt(settings.quality, 10),
          setQuality = (index) => {
            qualityLevels.selectedIndex = index;
            qualityLevels.dispatchEvent(new Event('change'));
            _.removeAds('.clsTempMSg');
          };
      // try to find exact quality level
      for (let i = 0; i < qualityLevels.length; i++) {
        if (desiredQuality === parseInt(qualityLevels.options[i].innerHTML, 10)) {
          setQuality(i);
          qualitySet = true;
          break;
        }
      }

      // try to find best level alternate
      if (!qualitySet) {
        // check if desired level is higher than all available
        if (desiredQuality < parseInt(qualityLevels.options[qualityLevels.length - 1].innerHTML, 10)) {
          setQuality(qualityLevels.length - 1);
        }
        // check if desired level is lower than all available
        else if (desiredQuality > parseInt(qualityLevels.options[0].innerHTML, 10)) {
          setQuality(0);
        }
        // else find level that is next smallest
        else {
          for (let i = 0; i < qualityLevels.length; i++) {
            if (desiredQuality > parseInt(qualityLevels.options[i].innerHTML, 10)) {
              setQuality(i);
            }
          }
        }
      }

      settings.autoPause && my_video_1_html5_api.pause(); // auto pause
      my_video_1_html5_api.volume = settings.volume / 100; // volume
      my_video_1_html5_api.addEventListener('ended', _.checkAutoAdvance); // auto advance
    };
    // inject function into page
    unsafeWindow.html5Hook = exportFunction(html5Hook, unsafeWindow);
    // call the injected script
    unsafeWindow.html5Hook();

    // remove any ghost vjs-tip (html5 player)
    setInterval(() => { _.queryAll('#vjs-tip').slice(1).forEach(elt => elt.remove()); }, 500);
  }
  // end per player settings

  // scroll to the container
  settings.autoScroll && document.getElementById('container') && setTimeout(() => { document.getElementById('container').scrollIntoView(true); }, 0);

  // key listener
  let keyListener = (evt) => {
    if (!useFlash) {
      let video = unsafeWindow.my_video_1_html5_api,
          videoFocused = (unsafeWindow.document.activeElement === video);

      // speed controls (html5)
      if (evt.code === 'Minus' || evt.code == 'Equal' && videoFocused) {
        video.playbackRate += ((evt.code === 'Minus' && video.playbackRate > 0.25)? -0.25 : (evt.code == 'Equal' && video.playbackRate < 5) ? 0.25 : 0);
        evt.preventDefault();
      }

      // large seek (html5)
      let largeSeek = 20;
      if (evt.ctrlKey && (evt.code === 'ArrowLeft' || evt.code === 'ArrowRight') && videoFocused) {
        video.currentTime += ((evt.code === 'ArrowLeft') ? -largeSeek : largeSeek);
        evt.preventDefault();
      }
    }

    // prev / next video navigate
    if (evt.code === 'NumpadMultiply' || evt.code === 'NumpadSubtract') {
      (evt.code === 'NumpadMultiply') ? _.previousVideo() : _.nextVideo();
      evt.preventDefault();
    }
  };
  // add the listener for keydown
  window.addEventListener('keydown', keyListener);

  console.log('Finished cleaning video page.');
}

//---------------------------------------------------------------------------------------------------------------
// Clean All pages
//---------------------------------------------------------------------------------------------------------------
console.log('Starting general page cleaning...')

// remove share stuff next to search bar
// get the search element near the top of the page
let result_box = document.getElementById('result_box');
if (result_box) {
  let ad = result_box.nextElementSibling;
  if (ad && (ad.children.length === 0 || !ad.children[0].matches('a[href*="AdvanceSearch"]'))) {
    ad.remove();
  }
}

// remove login at the top of the page
settings.removeLogin && _.removeAd('#topHolderBox');

// remove pointless tabs
// remove footer
// remove ad hides
_.removeAds('#liMobile', '#liReportError', '#liRequest', '#liCommunity', '#liFAQ', '#liReadManga', '#footer', 'div.divCloseBut');

// keys listener for script mnu otions
// home key
let settingsMenu,
    isSettingsMenuOpen = false;
let openSettingsMenu = () => {
  if (!isSettingsMenuOpen) {
    isSettingsMenuOpen = true;

    // create settings settingsMenu if it doesn't exist
    if (settingsMenu == null) {
      let preview = document.implementation.createHTMLDocument('preview');
      preview.documentElement.innerHTML = GM_getResourceText('settings');
      settingsMenu = preview.getElementById('kisscleaner-settings-container');
    }

    // set settingsMenu option values from current settings
    let nodes = Array.from(settingsMenu.querySelectorAll('[name]'));
    nodes.forEach((node) => {
      if (settings.hasOwnProperty(node.name)) {
        let value = settings[node.name];
        if (node.type === 'checkbox') {
          node.checked = value;
        } else {
          node.value = value;
        }
      }
    });

    // add settings settingsMenu to page
    document.getElementById('containerRoot').appendChild(settingsMenu);

    // add save button listener
    document.getElementById('kisscleaner-settings-save').addEventListener('click', saveSettingsMenu);
  } else {
    saveSettingsMenu();
  }
};
let saveSettingsMenu = () => {
  // save values
  let nodes = Array.from(settingsMenu.querySelectorAll('[name]')),
      changes = false;
  nodes.forEach((node) => {
    if (settings.hasOwnProperty(node.name)) {
      let value = ((node.type === 'checkbox') ? node.checked : node.value);
      if (settings[node.name] !== value) {
        changes = true;
      }
      GM_setValue(node.name, (settings[node.name] = value));
    }
  });

  // update player cookie
  if (settings.player === PLAYER.FLASH) {
    document.cookie = 'usingFlashV1=true;path=/';
    document.cookie = 'usingHTML5V1=; expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/';
  } else {
    document.cookie = 'usingFlashV1=; expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/';
    document.cookie = 'usingHTML5V1=true;path=/';
  }

  // reload page to make changes
  if (changes) {
    window.location.href = window.location.href;
  }

  settingsMenu.remove();
  isSettingsMenuOpen = false;
};
// create global key listener
let globalKeyListener = (evt) => {
  if (evt.code == 'Home') {
    // prevent default action of scrolling to top of page
    evt.preventDefault();
    openSettingsMenu();
  }
};
// inject functions into page
unsafeWindow.openSettingsMenu = exportFunction(openSettingsMenu, unsafeWindow);
unsafeWindow.saveSettingsMenu = exportFunction(saveSettingsMenu, unsafeWindow);
// add the listener for keypresses
window.addEventListener('keydown', globalKeyListener);
// also add as GM menu command
GM_registerMenuCommand('KissCleaner Settings', unsafeWindow.openSettingsMenu);

// search box navigation
let searchResults = document.getElementById('searchResults'); // search results
let searchBox = document.getElementById('keyword'); // search form text box
// TODO arrow scroll through search results

console.log('Finished general page cleaning.');
console.log('Finished initialization.');
