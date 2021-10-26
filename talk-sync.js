/// \file
///
/// This script creates the UI for viewing the video and the slides in
/// kiosk mode, handles the synchronization (advance the slides as the
/// video plays) and the user interaction (enter/exit the mode,
/// play/pause, skip forward/backwards, select the caption language, etc.)
///
/// The script is meant to be loaded at the end of the document, when
/// the DOM has been created.
///
/// \author Bert Bos <bert@w3.org>
/// \date Created: 25 December 2020
/// \date Last modified: $Date: 2021/10/11 17:32:04 $ by $Author: bbos $

(function() {

  "use strict";

  let sync_elt;   ///< A checkbox to enter/exit kiosk mode
  let mode_elt;   ///< A label element for the sync_elt
  let help_elt;   ///< A link to some help text
  let old_comments_elt; ///< A DIV to put downloaded comments in
  let first_slide_elt;  ///< A button to jump to the first slide
  let prev_slide_elt; ///< A button to jump one slide back
  let play_elt;   ///< A button to play/pause the video
  let next_slide_elt; ///< A button to jump one slide forward
  let last_slide_elt; ///< A button to jump to the last slide
  let slidenr_elt;  ///< An output element with the slide number
  let caption_elt;  ///< A p for the caption and the language select
  let no_captions_elt;  ///< An option element for "no captions"
  let cue_elt;    ///< An output element for the caption
  let cuelang_elt;  ///< A select element for the caption language
  let slides_elt;     ///< Element that wraps the slides and transcript
  let video_elt_real; ///< The video element
  let video_elt;  ///< The video element, or the proxy for a remote player
  let container_elt;  ///< The parent of slides_elt and video_elt
  let prev_talk_elt;  ///< The element that links to the previous talk
  let prev_talk_elt2; ///< A copy for in the buttonbar
  let all_talks_elt;  ///< The element that links to the agenda page
  let all_talks_elt2; ///< A copy for in the buttonbar
  let next_talk_elt;  ///< The element that links to the next talk
  let next_talk_elt2; ///< A copy for in the buttonbar
  let buttons_elt;  ///< A container for various buttons
  let group_1_elt;  ///< A group of buttons inside buttons_elt
  let group_2_elt;  ///< A group of buttons inside buttons_elt
  let group_3_elt;  ///< A group of buttons inside buttons_elt
  let query;    ///< Query string, if any
  let sync_param; ///< "sync" parameter from the query string
  let cuelang_param;  ///< "cuelang" parameter from the query string
  let sync_elts;  ///< Slides and incremental display elements
  let current = 0;  ///< Which of the sync_elts is active
  let curslide = 0; ///< Currently visible slide (index in sync_elts)
  let cuelang;    ///< Current caption language
  let subtitles;  ///< Array of captions/subtitles
  let timecodes = [0];  ///< Array of times at which to show each slide


  /// Show the slide label in the output element.
  ///
  /// \param n the slide number to show.
  ///
  function announce(n)
  {
    let label = sync_elts[n].getAttribute("aria-label");
    let target = sync_elts[n].id;

    if (!target) {    // Just show the slide number
      slidenr_elt.textContent = label;
    } else {      // Make the slide number into a link
      while (slidenr_elt.firstChild)
  slidenr_elt.removeChild(slidenr_elt.firstChild);
      let e = document.createElement("a");
      e.textContent = label;
      e.href = "#" + target;
      slidenr_elt.appendChild(e);
    }
  }


  /// Set the video to the start time of the current slide.
  ///
  function seek_video()
  {
    if (!(current in timecodes)) return;
    if (!video_elt.contentWindow) video_elt.currentTime = timecodes[current];
    else video_elt.contentWindow.postMessage(["seek", timecodes[current]], "*");
  }


  /// Start the video player.
  ///
  function play_video()
  {
    if (video_elt.play) {     // A VIDEO or AUDIO element, or a proxy object
      video_elt.play().catch(function(err) {console.log(err)});
    } else {      // An IFRAME
      video_elt.contentWindow.postMessage(["play"], "*");
      video_elt.paused = false;
      video_elt.dispatchEvent(new Event("play")); // Synthesize our own event
    }
  }


  /// Pause the video player.
  ///
  function pause_video()
  {
    if (video_elt.pause) {  // A VIDEO or AUDIO element
      video_elt.pause();
    } else {      // An IFRAME
      video_elt.contentWindow.postMessage(["pause"], "*");
      video_elt.paused = true;
      video_elt.dispatchEvent(new Event("pause")); // Synthesize our own event
    }
  }


  /// Deactivate the current element and activate the new one.
  /// \param new_index the index in `sync_elts` of the element to make current
  ///
  /// The function sets `current` to `new_index` (thus making the
  /// element `sync_elts[new_index]` the current element), removes the
  /// class `active` from the previous current element and sets it on
  /// the new current element instead. It also sets the class
  /// `visited` on all elements in `sync_elts` between the old current
  /// element and the new one, including the new current element.
  ///
  function activate(new_index)
  {
    if (new_index < current) {

      // Make all items between the new and the old item inactive.
      while (current > new_index) {
  sync_elts[current].classList.remove("visited");
  sync_elts[current].classList.remove("active");
  current--;
      }

      // Find the containing slide.
      let i = new_index;
      while (i > 0 && !sync_elts[i].classList.contains("slide")) i--;

      // assert: The first sync_elts is always a slide, i.e.,
      // sync_elts[0].classList.contains("slide")

      // If this is a new slide, make it active and announce it.
      if (i != curslide) {
  curslide = i;
  sync_elts[curslide].classList.add("active");
  sync_elts[current].classList.remove("visited");
  announce(curslide);
      }

    } else if (new_index > current) {

      // Find containing slide of old current item.
      let j = current;
      while (j > 0 && !sync_elts[j].classList.contains("slide")) j--;

      // Find containing slide of new current item.
      let i = new_index;
      while (i > 0 && !sync_elts[i].classList.contains("slide")) i--;

      // Make all slides between j and i inactive and visited,
      // and all incremental items active.
      while (j < i) {
  if (sync_elts[j].classList.contains("slide")) {
    sync_elts[j].classList.remove("active");
    sync_elts[j].classList.add("visited");
  } else {
    sync_elts[j].classList.add("active");
  }
  j++;
      }

      // Make the current slide and all incremental items on the
      // current slide up to the new item active.
      while (j < new_index)
  sync_elts[j++].classList.add("active");

      // Make the new current element active.
      current = new_index;
      sync_elts[current].classList.add("active");

      // If this is a new slide, announce it.
      if (curslide !== i) {
  curslide = i;
  announce(curslide);
      }
    }
  }


  // /// Calculate the transform to scale the document to the window
  // ///
  // /// This is called as an event handler on resize events and also by
  // /// set_kiosk_mode when entering kiosk mode. It sets a 'transform'
  // /// property on the BODY that scales the element to be exactly as
  // /// wide as the window. That requires that the BODY has a definite
  // /// width. The transform only applies when the BODY is absolutely or
  // /// relatively positioned. It is up to the stylesheet to set the
  // /// 'position' property.
  // function set_body_scale()
  // {
  //   var scale;

  //   scale = window.innerWidth/document.body.offsetWidth;
  //   document.body.style.transform = "scale(" + scale + ")";
  // }


  /// Select transcript (false) or kiosk mode (true).
  /// \param force_kiosk_mode (boolean)
  ///
  /// The function removes or sets the class `sync` from the `BODY`
  /// element of the document. When removing it, i.e., when leaving
  /// kiosk mode for transcript mode, it also tries to scroll the page
  /// so that the checkbox that toggles between kiosk and transcript
  /// mode stays at the same height in the browser window, despite the
  /// extra text that is now visible on the page above the checkbox.
  ///
  function set_kiosk_mode(force_kiosk_mode)
  {
    if (force_kiosk_mode) {
      // document.documentElement.requestFullscreen();
      document.body.classList.add("sync");
      if (sync_elts.length === 1 && sync_elts[0] === document.body) {
        document.body.classList.add("noslides");
      }
      // set_body_scale();
    } else {
      // document.exitFullscreen();
      // Get the vertical position of the sync button.
      let r1 = mode_elt.getBoundingClientRect();
      let y1 = r1.top + window.scrollY;
      // Remove kiosk mode.
      document.body.classList.remove("sync");
      if (sync_elts.length === 1 && sync_elts[0] === document.body) {
        document.body.classList.remove("noslides");
      }
      // Scroll so that the sync button is at same vertical position again.
      let r2 = mode_elt.getBoundingClientRect();
      let y2 = r2.top + window.scrollY;
      window.scroll(window.scrollX, y2 - y1);
    }
  }


  /// Event handler to enter or exit kiosk mode.
  /// \param ev the event that triggered this action
  ///
  /// This event handler is attached to a checkbox. It calls
  /// set_kiosk_mode() to do the work.
  ///
  function toggle_mode(ev)
  {
    ev.preventDefault();
    set_kiosk_mode(this.checked);
    ev.stopPropagation();
  }


  /// Event handler to jump to the first slide.
  /// \param ev the event that triggered the action
  ///
  /// This event handler is attached to a button. It calls activate()
  /// to make element 0 in the `sync_elts` list the current element
  /// and repositions the video accordingly, with seek_video().
  ///
  function first_slide(ev)
  {
    ev.preventDefault();
    activate(0);    // Move the "active" class
    // console.log("first: current = "+current+" t -> "+timecodes[current]);
    seek_video();
  }


  /// Event handler to jump to the preceding slide.
  /// \param ev the event that triggered the action
  ///
  /// The event handler is attached to a button. It calls activate()
  /// to make the element before the current element the new current
  /// element (unless the current element is
  /// already the first element). It then repositions the video
  /// accordingly with seek_video().
  ///
  function prev_slide(ev)
  {
    ev.preventDefault();
    if (current == 0) return; // Already at first element
    activate(current - 1); // Move the "active" class
    //console.log("prev: current = "+current+" t -> "+timecodes[current]);
    seek_video();
  }


  /// Event handler to play/pause the video.
  /// \param ev the event handler that triggered the action
  ///
  /// The event handler is attached to a button. It calls either
  /// play_video() or pause_video(), depending on whether the video is
  /// currenty playing.
  ///
  function toggle_play_pause(ev)
  {
    ev.preventDefault();
    if (video_elt.paused || video_elt.ended) play_video(); else pause_video();
  }


  /// Event handler to jump to the next slide.
  /// \param ev the event that triggered the action
  ///
  /// The event handler is attached to a button. It calls activate()
  /// to make the next slide the current one (unless the current slide
  /// is the last one) and calls seek_vide() to position the video
  /// accordingly.
  ///
  function next_slide(ev)
  {
    ev.preventDefault();
    if (current == sync_elts.length - 1) return; // No next element
    activate(current + 1);  // Move the "active" class
    //console.log("next: current = "+current+" t -> "+timecodes[current]);
    seek_video();
  }


  /// Event handler to jump to the last slide.
  /// \param ev the event that triggered the action
  ///
  /// The event handler is attached to a button. It calls activate()
  /// to make the last element in the `sync_elts` list the current one
  /// and calls seek_video() to position the video accordingley.
  ///
  function last_slide(ev)
  {
    ev.preventDefault();
    // This isn't the last slide, but the last item on the last slide...
    activate(sync_elts.length - 1); // Move the "active" class
    // console.log("last: current = "+current+" t -> "+timecodes[current]);
    seek_video();
  }


  /// Event handler for the language select element.
  /// \param ev the event that triggered the action
  ///
  /// The event handler is attached to a select control. It sets
  /// `cuelang` to the selected language (a language code, such as
  /// 'en' or 'ja') and updates the contents of the element `cue_elt`
  /// to display the current caption in the selected language.
  ///
  function change_language(ev)
  {
    cuelang = this.value;

    // Set the lang attribute of the cue_elt.
    cue_elt.setAttribute("lang", cuelang);

    // Set the cue_elt to the current caption in the chosen language.
    let i = 0, len = subtitles.length;
    while (i < len && subtitles[i].language !== cuelang) i++;
    if (i == len) {
      cue_elt.innerHTML = "";
    } else {
      let t = subtitles[i];
      if (t.mode === "disabled") t.mode = "hidden"; // Ensure it will be loaded
      if (!t.activeCues || !t.activeCues.length) cue_elt.innerHTML = "";
      else cue_elt.innerHTML = t.activeCues[0].text;
    }
  }


  /// Event handler for when the caption changes in the video.
  /// \param ev the event that triggered the action
  ///
  /// The event handler is attached to all text tracks in a video
  /// element. (If the video is external, in an IFRAME, this event
  /// handler cannot be used.) When the current caption in the text
  /// track changes, this handler copies the new current caption into
  /// the `cue_elt` element, but only if the currently selected
  /// language (`cuelang`) is the same as the language of that text
  /// track.
  ///
  function change_cue(ev)
  {
    if (this.language !== cuelang) return; // Not the selected language

    if (!this.activeCues.length) cue_elt.innerHTML = "";
    else cue_elt.innerHTML = this.activeCues[0].text; // Only show one
  }


  /// Event handler for when the video position changes.
  /// \param ev the event that triggered the action
  ///
  /// The event handler is attached to a VIDEO element's `timeupdate`
  /// event, or, if the video is external, to the IFRAME's `message`
  /// event. It uses the timecode that is passed in the event to look
  /// up which slide should be shown at that time and calls activate()
  /// to make that slide the current one. The array `timecodes`
  /// contains for each slide (or, more precisely, for each element in
  /// `sync_elts`) at what timecodes in seconds it should be shown.
  ///
  function sync_slide(ev)
  {
    let t;      // The position in the video

    if (ev.type === "timeupdate") t = video_elt.currentTime;
    else if (ev.type === "message" && ev.data[0] === "position") t = ev.data[1];
    else return;    // Probably some other "message" event

    // if (ev.type === "message")
    //   console.log("event " + ev.type + "/" + ev.data[0] + " " + ev.data[1]);

    // Find index corresponding to time t. Search forward then
    // backward. Most of the time, the video just advances a bit, so
    // we search near the previous position. But if the user seeks the
    // video to a very different location, a binary search would have
    // been better. Still, the timecodes array is probably only a few
    // dozen entries long, so it probably doesn't matter.
    let i = Math.min(current, timecodes.length - 1);
    while (i < timecodes.length - 1 && t > timecodes[i]) i++;
    while (i > 0 && t < timecodes[i]) i--;

    // If i is not the current element, move the "active" class.
    activate(i);
  }


  /// Return index of `x` in array `a`, or -1 if not found.
  /// \param x a value
  /// \param a an array
  /// \param cmp a function that compares two values
  ///
  /// Uses binary search to find what index in array `a` corresponds
  /// to the value `x`. The array must be ordered. The function `cmp`
  /// gets two arguments: `x` and a value from the array `a`. It must
  /// return a value < 0 if `x` is less than the second argument, 0 if
  /// `x` matches the second argument, and > 0 if `x` is greater than
  /// the second argument.
  ///
  function search(x, a, cmp)
  {
    let lo = 0, hi = a.length - 1;
    while (lo <= hi) {
      let m = Math.floor((lo + hi)/2), r = cmp(x, a[m]);
      if (r < 0) hi = m - 1;
      else if (r > 0) lo = m + 1;
      else return m;
    }
    return -1;
  }


  /// Set the caption as the (external) video advances.
  /// \param ev the event that triggered the action
  ///
  /// The event handler can be attached to an IFRAME that contains an
  /// external video player or to an object that acts as a proxy for
  /// an external player, such as created by Cloudflare's video player
  /// API. (It could also be attached to a VIDEO or AUDIO element, but
  /// it is better to instead attach the `change_cue` handler to the
  /// `cuechange` events of each cue in the text tracks of those
  /// elements, because that is more efficient.)
  ///
  /// The event is triggered by a `message` event containing the
  /// string `"position"` and a timecode, or by a `timeupdate` event.
  /// The event handler finds in each of the lists of captions in
  /// `subtitles` the caption that corresponds to the timecode and
  /// displays the caption for the currently selected language
  /// (`cuelang`).
  ///
  function sync_cue(ev)
  {
    let t;      // The position in the video

    if (ev.type === "timeupdate") t = video_elt.currentTime;
    else if (ev.type === "message" && ev.data[0] === "position") t = ev.data[1];
    else return;    // Probably some other "message" event

    // Loop over all languages.
    for (let j = 0; j < subtitles.length; j++) {

      // Find the caption corresponding to time t.
      let i = search(t, subtitles[j].cues,
  function(a,b) {return a<b.startTime ? -1 : a>b.endTime ? 1 : 0});

      // Set the active cue.
      subtitles[j].activeCues[0].text = i < 0 ? "" : subtitles[j].cues[i].text;

      // If this is the currently selected language, show the cue.
      if (subtitles[j].language === cuelang)
  cue_elt.innerHTML = subtitles[j].activeCues[0].text;
    }
  }


  /// Event handler for when the video ends.
  /// \param ev the event that triggered the action
  ///
  /// The event handler is attached to the 'ended` event of a `VIDEO`
  /// element. (If the video is external, in an `IFRAME`, this event
  /// handler cannot be used.) It removes the caption currently shown
  /// in the `cue_elt` element, if any, and instead displays a link to
  /// the HTML page with the next video. Or nothing, if there is no
  /// next page. The link to the next page is copied from the
  /// `next_talk_elt` element.
  ///
  function video_ended(ev)
  {
    if (!next_talk_elt) return;
    while (cue_elt.firstChild) cue_elt.removeChild(cue_elt.firstChild);
    cue_elt.appendChild(next_talk_elt.cloneNode(true));
    cue_elt.removeAttribute("lang");
  }


  /// Event handler for when a text track is disabled/enabled.
  /// \param ev the event that triggered the action
  ///
  /// The event handler is attached to the `change` event of the
  /// textTracks object of a video element. (If the video is external,
  /// in an `IFRAME`, this event cannot be used.) If any text track
  /// contained in that textTracks object has a mode of `"disabled"`,
  /// the event handler changes the mode to `"hidden"`. This causes
  /// the text track to be downloaded (but not yet displayed), so that
  /// it will be available when the user later chooses that text track
  /// as captions.
  ///
  function track_change(ev)
  {
    for (let i = 0, len = this.length; i < len; i++)
      if (this[i].mode === "disabled") this[i].mode = "hidden";
    // The change of mode causes the event handler to be called
    // again. But that is OK.
  }


  /// Event handler to position the video to a certain point.
  /// \param ev the event that triggered the action
  ///
  /// This event handler is attached to the `click` event of several
  /// buttons. The buttons must have a `data-slide` attribute that
  /// contains the number of a slide (i.e., an index into the
  /// `sync_elts` array, with the first slide having index 0). The
  /// function calls activate() to make the slide with that number the
  /// current one and it calls seek_video() and then play_video() to
  /// position the video at the corresponding position and, if it
  /// wasn't playing yet, to start it playing.
  ///
  function play_here(ev)
  {
    ev.preventDefault();
    activate(parseInt(this.getAttribute("data-slide"), 10));
    seek_video();
    play_video();
    ev.stopPropagation();
  }


  /// Return time codes of cues that start a slide.
  /// \param cues an array of captions (a TextTrackCueList or compatible)
  ///
  /// The function looks through the list of cues for any cues that
  /// have an `id` property whose value starts with `"slide-"`. (E.g.,
  /// `"slide-1"`, `"slide-2"`, etc., but the actual string that comes
  /// after the dash is unimportant.) Such a cue indicates that the
  /// speaker started a new slide just before he spoke the text of
  /// this cue. The `startTime` property of the cue is copied to the
  /// `timecodes` array, which thus ends up holding the starting time
  /// codes of all slides. The start time of the first slide is forced
  /// to 0, independent of the startTime of the first cue.
  ///
  /// (To work around bugs and limitations in the StreamFizz video
  /// player, which we use for most videos, the time codes stored in
  /// the `timecodes` array are rounded down to whole seconds; except
  /// if for 0 seconds, which is stored as 0.01.)
  ///
  function get_slide_times_from_track(cues)
  {
    let timecodes = [];

    timecodes[0] = 0.01;
    for (let j = 0; j < cues.length; j++)
      // If a cue's ID starts with "slide-", it marks the start of a slide.
      // If it starts with "next-", it marks an incremental item on a slide.
      if (cues[j].id.startsWith("slide-") || cues[j].id.startsWith("next-")) {
  // The StreamFizz player cannot seek to fractional
  // seconds. It rounds down to whole seconds. So to keep our
  // slides in sync, we round the timecodes down.
  if (video_elt instanceof HTMLIFrameElement)
    timecodes.push(Math.floor(cues[j].startTime));
  else
    timecodes.push(cues[j].startTime);
      }
    // Force the first time code to 0. The StreamFizz player has a bug
    // and cannot seek to 0, so we actually set it to 0.01.
    if (timecodes.length) timecodes[0] = 0.01;
    return timecodes;
  }


  // If there is a query string in the URL, it sets some defaults.
  query = (/\?(.*$)/.exec(document.location.search) || ['',''])[1];
  sync_param = (/(^|&|;)sync=([^&;]*)/.exec(query) || ['','',''])[2];
  cuelang_param = (/(^|&|;)cuelang=([^&;]*)/.exec(query) || ['','',''])[2];

  // Find some elements we need.
  slides_elt = document.getElementById("slides");
  if (!slides_elt) console.error("There is no element with id=slides");
  video_elt = video_elt_real = document.getElementById("video");
  if (video_elt && video_elt.tagName === 'IFRAME' && window.Stream)
    video_elt = Stream(video_elt); // Create Cloudflare's proxy object
  container_elt = slides_elt.parentNode;
  prev_talk_elt = document.getElementById("prevtalk");
  all_talks_elt = document.getElementById("alltalks");
  next_talk_elt = document.getElementById("nexttalk");
  sync_elts = document.querySelectorAll("i-slide, .slide, .next");
  if (!sync_elts.length) sync_elts = [document.body];

  // If the video is playing in an IFRAME, we cannot ask it whether it
  // is playing or paused. We assume it starts out not playing.
  if (video_elt && !video_elt.play) video_elt.paused = true;

  // Make the first slide (if any) the active one.
  if (sync_elts.length) sync_elts[0].classList.add('active');

  // If there is a global slide_times array, initialize timecodes from it.
  if (typeof slide_times !== "undefined") {
    if (slide_times.length == sync_elts.length) timecodes = slide_times;
    else console.warn("The slide_times array has %d entries, but there are %d slides & incremental elements. Not using the slide_times array.",
      slide_times.length, sync_elts.length);
  }

  if (video_elt) {

    // Get the subtitles either from the video/audio element, or from
    // the global captions variable. In the former case, the browser
    // already loaded and parsed them. In the latter case, we need to
    // download and parse them here. The timecodes arrays is set from
    // the captions file that yields the most timecodes (or the last
    // file if there is no difference), on the assumption that the one
    // with the most time codes is the most precise.
    if (typeof captions === "undefined") {
      subtitles = video_elt.textTracks;
      let tracks = video_elt.getElementsByTagName('track');
      for (let i = tracks.length - 1; i >= 0; i--) {
  if (tracks.item(i).readyState == HTMLTrackElement.LOADED) {
    let t = get_slide_times_from_track(tracks.item(i).track.cues);
    if (t.length == sync_elts.length)
      timecodes = t;
    else if (t.length)
      console.warn("Found %d time codes in the captions for %s, but there are %d slides & incremental elements. Not using those time codes.",
        t.length, tracks[i].track.language, sync_elts.length);
  } else {
    tracks.item(i).addEventListener('load', function(ev) {
      let t = get_slide_times_from_track(ev.target.track.cues);
      if (t.length == sync_elts.length)
        timecodes = t;
      else if (t.length)
        console.warn("Found %d time codes in the captions for %s, but there are %d slides & incremental elements. Not using those time codes.",
        t.length, tracks[i].track.language, sync_elts.length);
    });
  }
      }
    } else {
      subtitles = captions;

      // Download and parse the captions. Also fill the timecodes
      // array with the time codes of any cues in the captions files
      // that are marked as starting a new slide.
      // The timecodes arrays is set from the captions file that
      // yields the most timecodes (or the last file, in case there is
      // no difference), on the assumption that the file with the most
      // time codes is the most precise.
      for (let i = subtitles.length - 1; i >= 0; i--) {
  let lang = subtitles[i].language;
  let req = new XMLHttpRequest();
  req.addEventListener("load", function(ev) {
          let parser = new WebVTTParser();
          let tree = parser.parse(ev.target.responseText, "captions");
          if (tree.errors.length)
            cue_elt.textContent = "Error: line " + tree.errors[0].line +
            " of " + lang + ": " + tree.errors[0].message;
          for (let j = tree.cues.length - 1; j >= 0; j--)
            tree.cues[j].text = tree.cues[j].text.replace(/<\/?v[^>]*>/g,"");
    let t = get_slide_times_from_track(tree.cues);
    if (t.length == sync_elts.length)
      timecodes = t;
    else if (t.length)
      console.warn("Found %d time codes in %s, but there are %d slides & incremental elements. Not using those time codes.",
      t.length, ev.target.responseURL, sync_elts.length);
    subtitles[i].cues = tree.cues;
  });
  req.open("GET", subtitles[i].src); // Download in the background
  req.withCredentials = true;
  req.send();
      }

      // We also need an event handler to set the caption when the
      // video advances, because the video's textTracks will not send
      // us "cuechange" events." Cloudflare's proxy object will
      // generate "timeupdate" events, while StreamFizz's player
      // generates "message" events.
      video_elt.addEventListener("timeupdate", sync_cue);
      window.addEventListener("message", sync_cue);
    }
  }       // if (video_elt)

  // Add the elements that are only used when JavaScript is available.

  // A p element to contain various groups of buttons.
  buttons_elt = document.createElement("p");
  buttons_elt.setAttribute("id", "buttonbar");

  // The first group contains a checkbox, a help button and a
  // label/checkbox. It is only created if there is a video.
  if (video_elt) {

    group_1_elt = document.createElement("span");

    // sync_elt is a checkbox to enter/exit kiosk mode.
    sync_elt = document.createElement("input");
    sync_elt.setAttribute("id", "sync");
    sync_elt.setAttribute("name", "sync");
    sync_elt.setAttribute("type", "checkbox");
    sync_elt.setAttribute("form", "form");
    if (sync_param === "on") sync_elt.setAttribute("checked", "");
    sync_elt.addEventListener("change", toggle_mode);

    // mode_elt is a label for the sync_elt.
    mode_elt = document.createElement("label");
    mode_elt.setAttribute("for", "sync");
    mode_elt.setAttribute("class", "button");
    mode_elt.textContent = " Kiosk mode";
    mode_elt.insertBefore(sync_elt, mode_elt.firstChild);
    group_1_elt.appendChild(mode_elt);

    // help_elt is a link to some help text.
    help_elt = document.createElement("a");
    help_elt.setAttribute("href", "../talk-help.html");
    help_elt.setAttribute("title", "Help");
    help_elt.classList.add("button");
    help_elt.classList.add("picto");
    help_elt.classList.add("im-question");
    group_1_elt.appendChild(help_elt);

    buttons_elt.appendChild(group_1_elt);

  } else {      // There is no video_elt

    // Create a hidden input element for the sync parameter. This way
    // the parameter is preserved if the user continues to a page that
    // does have a video.
    sync_elt = document.createElement("input");
    sync_elt.setAttribute("form", "form");
    sync_elt.setAttribute("name", "sync");
    sync_elt.setAttribute("type", "hidden");
    sync_elt.setAttribute("value", sync_param);
    container_elt.parentNode.insertBefore(sync_elt, container_elt);
  }       // if (video_elt)


  // The second group contains buttons to navigate the slides. It is
  // only created if there is a video to synchronize with.
  if (video_elt) {

    group_2_elt = document.createElement("span");

    // first_slide_elt is button to jump to the first slide
    first_slide_elt = document.createElement("button");
    first_slide_elt.setAttribute("title", "First slide");
    first_slide_elt.classList.add("picto");
    first_slide_elt.classList.add("im-previous");
    first_slide_elt.addEventListener("click", first_slide, true);
    group_2_elt.appendChild(first_slide_elt);

    // prev_slide_elt is a button to jump one slide back
    prev_slide_elt = document.createElement("button");
    prev_slide_elt.setAttribute("title", "Previous slide");
    prev_slide_elt.classList.add("picto");
    prev_slide_elt.classList.add("im-arrow-left");
    prev_slide_elt.addEventListener("click", prev_slide, true);
    group_2_elt.appendChild(prev_slide_elt);

    // play_elt is a button to play or pause the video
    if (video_elt) {
      play_elt = document.createElement("button");
      play_elt.setAttribute("title", "Play");
      play_elt.classList.add("picto");
      play_elt.classList.add("im-play");
      play_elt.addEventListener("click", toggle_play_pause, true);
      group_2_elt.appendChild(play_elt);
      video_elt.addEventListener("play", function(ev) {
  play_elt.setAttribute("title", "Pause");
  play_elt.classList.remove("im-play");
  play_elt.classList.add("im-pause");});
      video_elt.addEventListener("ended", function(ev) {
  play_elt.setAttribute("title", "Play");
  play_elt.classList.remove("im-pause");
  play_elt.classList.add("im-play");});
      video_elt.addEventListener("pause", function(ev) {
  play_elt.setAttribute("title", "Play");
  play_elt.classList.remove("im-pause");
  play_elt.classList.add("im-play");});
    }

    // next_slide_elt is a button to jump to the next slide.
    next_slide_elt = document.createElement("button");
    next_slide_elt.setAttribute("title", "Next slide");
    next_slide_elt.classList.add("picto");
    next_slide_elt.classList.add("im-arrow-right");
    next_slide_elt.addEventListener("click", next_slide, true);
    group_2_elt.appendChild(next_slide_elt);

    // last_slide_elt is a button to jump to the last slide.
    last_slide_elt = document.createElement("button");
    last_slide_elt.setAttribute("title", "Last slide");
    last_slide_elt.classList.add("picto");
    last_slide_elt.classList.add("im-next");
    last_slide_elt.addEventListener("click", last_slide, true);
    group_2_elt.appendChild(last_slide_elt);
    buttons_elt.appendChild(group_2_elt);

  }       // if (video_elt)

  // The third group contains buttons to navigate the talks.
  group_3_elt = document.createElement("span");

  // prev_talk_elt2 is a button to go to the preceding talk.
  prev_talk_elt2 = document.createElement("button");
  prev_talk_elt2.setAttribute("form", "form");
  prev_talk_elt2.classList.add("picto");
  prev_talk_elt2.classList.add("im-angle-left");
  if (prev_talk_elt && prev_talk_elt.tagName === "BUTTON") {
    prev_talk_elt2.setAttribute("type", "submit");
    prev_talk_elt2.setAttribute("title", prev_talk_elt.textContent);
    prev_talk_elt2.setAttribute("form", prev_talk_elt.getAttribute("form"));
    prev_talk_elt2.setAttribute("formaction",
      prev_talk_elt.getAttribute("formaction"));
  } else {
    prev_talk_elt2.setAttribute("disabled", "");
    prev_talk_elt2.setAttribute("title", "Already on the first talk");
  }
  group_3_elt.appendChild(prev_talk_elt2);

  // all_talks_elt2 is a link to the agenda.
  all_talks_elt2 = document.createElement("a");
  all_talks_elt2.classList.add("picto");
  all_talks_elt2.classList.add("im-data");
  all_talks_elt2.classList.add("button");
  if (all_talks_elt) {
    all_talks_elt2.setAttribute("title", all_talks_elt.textContent);
    all_talks_elt2.setAttribute("href", all_talks_elt.getAttribute("href"));
  } else {
    all_talks_elt2.setAttribute("disabled", "");
    all_talks_elt2.setAttribute("title", "The list of talks is not available");
  }
  group_3_elt.appendChild(all_talks_elt2);

  // next_talk_elt2 is a button to go the following talk.
  next_talk_elt2 = document.createElement("button")
  next_talk_elt2.setAttribute("form", "form");
  next_talk_elt2.classList.add("picto");
  next_talk_elt2.classList.add("im-angle-right");
  if (next_talk_elt && next_talk_elt.tagName === "BUTTON") {
    next_talk_elt2.setAttribute("type", "submit");
    next_talk_elt2.setAttribute("title", next_talk_elt.textContent);
    next_talk_elt2.setAttribute("form", next_talk_elt.getAttribute("form"));
    next_talk_elt2.setAttribute("formaction",
      next_talk_elt.getAttribute("formaction"));
  } else {
    next_talk_elt2.setAttribute("disabled", "");
    next_talk_elt2.setAttribute("title", "Already on the last talk");
  }
  group_3_elt.appendChild(next_talk_elt2);
  buttons_elt.appendChild(group_3_elt);
  container_elt.parentNode.insertBefore(buttons_elt, container_elt);

  // Create elements to show the current slide number and the captions.
  if (video_elt) {

    // slidenr_elt is an output element for the current slide number.
    slidenr_elt = document.createElement("output");
    slidenr_elt.setAttribute("id", "slidenr");
    announce(0);

    // caption_elt is a paragraph to hold the caption and the language selector.
    caption_elt = document.createElement("p");
    caption_elt.setAttribute("id", "caption");

    // cuelang_elt is a select element for the caption language.
    cuelang_elt = document.createElement("select");
    cuelang_elt.setAttribute("form", "form");
    cuelang_elt.setAttribute("id", "cuelang");
    cuelang_elt.setAttribute("name", "cuelang");
    cuelang_elt.setAttribute("title", "Language for subtitles");
    cuelang_elt.addEventListener("change", change_language);
    caption_elt.appendChild(cuelang_elt);

    // Add option elements for each caption language.
    cuelang = cuelang_param;
    for (let i = 0, len = subtitles.length; i < len; i++) {
      let lang = subtitles[i].language;
      let label = subtitles[i].label;
      let e = document.createElement("option");
      e.setAttribute("value", lang);
      e.setAttribute("lang", lang);
      if (!cuelang) cuelang = lang; // Use first available language as default
      if (cuelang === lang) e.setAttribute("selected", "");
      e.textContent = label ? label : lang; // TODO: what if both absent?
      cuelang_elt.appendChild(e);
    }

    // The last option in the select is "no captions".
    no_captions_elt = document.createElement("option");
    no_captions_elt.setAttribute("value", "x-none");
    if (cuelang === "x-none") no_captions_elt.setAttribute("selected", "");
    no_captions_elt.textContent = "no captions";
    cuelang_elt.appendChild(no_captions_elt);

    // cue_elt is an output element for the current caption.
    if (video_elt) {
      cue_elt = document.createElement("output");
      cue_elt.setAttribute("id", "cue");
      cue_elt.setAttribute("aria-live", "off");
      if (cuelang) cue_elt.setAttribute("lang", cuelang);
      if (video_elt.textTracks)
  for (let i = 0, len = video_elt.textTracks.length; i < len; i++)
    video_elt.textTracks[i].addEventListener("cuechange", change_cue);
      caption_elt.appendChild(cue_elt);
    }

    // Insert the created elements into the DOM.
    container_elt.insertBefore(caption_elt, slides_elt.nextSibling);
    container_elt.insertBefore(slidenr_elt, video_elt_real.nextSibling);

    // Set the initial mode to what was demanded in the query string.
    set_kiosk_mode(sync_param === "on");

    // Ensure text tracks are loaded and are never disabled.
    if (video_elt.textTracks) {
      video_elt.textTracks.addEventListener("change", track_change, true);
      for (let i = 0, len = video_elt.textTracks.length; i < len; i++)
  video_elt.textTracks[i].mode = "hidden"; // Ensure it will be loaded
    }

    // When the video plays, show the corresponding slide.
    video_elt.addEventListener("timeupdate", sync_slide);
    window.addEventListener("message", sync_slide);

    // When the video ends, show a link to the next talk in the captions area.
    video_elt.addEventListener("ended", video_ended);

    // Insert a button at the start of each section of the
    // transcript. When clicked, it plays the video starting at this
    // point.
    for (let i = 0; i < sync_elts.length; i++) {
      if (sync_elts[i].classList.contains("slide")) {
  let slidenr = sync_elts[i].getAttribute("aria-label") || sync_elts[i].textContent;
  let div = sync_elts[i].nextSibling;
  while (div !== null && div.nodeType !== 1) div = div.nextSibling;
  if (div !== null && div.tagName === "DIV" &&
      !div.classList.contains("slide")) {
    let button = document.createElement("button");
    button.classList.add("play-here");
    button.setAttribute("lang", "en-us"); // It may be inside non-English
    button.setAttribute("dir", "ltr");
    button.setAttribute("title", "Start playing at " + slidenr);
    button.setAttribute("data-slide", i);
    button.addEventListener("click", play_here, true);
    div.insertBefore(button, div.firstChild);
    button.appendChild(document.createTextNode("Play "));
    let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "-10 0 1162 1152");
    svg.setAttribute("width", "11.62");
    svg.setAttribute("height", "11.52")
    svg.classList.add("icon");
    button.appendChild(svg);
    let desc = document.createElementNS("http://www.w3.org/2000/svg", "desc");
    desc.textContent = "Play";
    svg.appendChild(desc);
    let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M144 1056v-960l864 480l-864 480v0z");
    path.setAttribute("fill","currentColor");
    svg.appendChild(path);
  }
      }
    }
  } else {      // There is no video_elt
    // Create a hidden input element for the cuelang parameter. This
    // way the parameter is preserved if the user continues to a page
    // that does have a video.
    cuelang_elt = document.createElement("input");
    cuelang_elt.setAttribute("form", "form");
    cuelang_elt.setAttribute("type", "hidden");
    cuelang_elt.setAttribute("name", "cuelang");
    cuelang_elt.setAttribute("value", cuelang_param);
    container_elt.parentNode.insertBefore(cuelang_elt, container_elt);
  }       // if (video_elt)

  // // An event handler to recalculate the scale factor for kiosk mode.
  // window.addEventListener('resize', set_body_scale, true);

 })();
