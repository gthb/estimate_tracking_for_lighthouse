// Estimate Tracking for Lighthouse
// version 0.1 BETA!
// 2008-06-20
// Copyright (c) 2008, Jesse Hallett <hallettj@gmail.com>
// Released under the GPL license
// http://www.gnu.org/copyleft/gpl.html
//
// --------------------------------------------------------------------
//
// This is a Greasemonkey user script.
//
// To install, you need Greasemonkey: http://greasemonkey.mozdev.org/
// Then restart Firefox and revisit this script.
// Under Tools, there will be a new menu item to "Install User Script".
// Accept the default configuration and install.
//
// To uninstall, go to Tools/Manage User Scripts,
// select "Estimate Tracking for Lighthouse", and click Uninstall.
//
// --------------------------------------------------------------------
//
// == USAGE:
//
// Record estimates for your Lighthouse tickets somewhere in the title of
// the ticket. Accepted units are days, hours and minutes. Here are some
// examples of ticket titles that will work:
//
//         Ticket with an estimate (2d4h30m)
//         Ticket with an estimate (3.5 hours)
//         Ticket with an estimate 30 minutes 1 day
//         2hrs 20min Ticket with an estimate
//
// With the estimate tracking script running, totals for estimates will
// be displayed on the milestone page. Each project member will have the
// total estimate of the amount of work they have left for the milestone
// displayed next to their name. Only estimates from open tickets are
// counted toward the total; so don't worry if there are closed tickets
// around that still have estimates on them.
//
// If you do some work on a ticket, but don't quite finish it - or if you
// just get better information about how long a task will take - you will
// probably want to update the estimate. To do that, just update the
// title of the ticket to reflect the new estimate.
//
// ==UserScript==
// @name          Estimate Tracking for Lighthouse
// @namespace     http://sitr.us/
// @description   Displays the total time left on open tickets on the milestone page of Lighthouse.
// @include       http://*.lighthouseapp.com/projects/*/milestones/*
// @include       https://*.lighthouseapp.com/projects/*/milestones/*
// ==/UserScript==

function FormatFloat(pFloat, pDp){
    var m = Math.pow(10, pDp);
    return parseInt(pFloat * m, 10) / m;
}

function formatTime(hours, useDays) {
  var timeDisp = '';
  if (useDays && hours >= 8.0) {
    var days = Math.floor(hours / 8.0);
    if (days == 1) {
      timeDisp += days + ' day ';
    } else {
      timeDisp += days + ' days ';
    }
    hours = hours % 8.0
      }
  if (hours > 0 && hours < 1) {
    var minutes = Math.floor(hours * 60.0);
    if (minutes == 1) {
      timeDisp += minutes + ' minute';
    } else {
      timeDisp += minutes + ' minutes';
    }
  } else if (hours > 0) {
    if (hours == 1.0) {
      timeDisp += FormatFloat(hours, 2) + ' hour';
    } else {
      timeDisp += FormatFloat(hours, 2) + ' hours';
    }
  }
  return timeDisp;
}

// Find the divs containing the lists of tickets assigned to each
// user. The divs are identified by an id of the format, 'tickets-userId'.
var ticketLists = document.evaluate(
  '//div[contains(@id,"tickets-")]',
  document,
  null,
  XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
  null);

// Add up the hours listed for each ticket in each ticket list
var useDays = false;
var totalHours = 0.0;
var maxHours = 0.0;
var maxHoursUser = null;
var unestimatedTickets = [];
for (var i=0; i < ticketLists.snapshotLength; i++) {
  var userHours = 0.0;

  // Tickets within the list are identified as links inside list item
  // nodes
  var tickets = document.evaluate(
    'ul/li/a[not(@class="tag")]',
    ticketLists.snapshotItem(i),
    null,
    XPathResult.ANY_TYPE,
    null);
  
  var thisTicket = tickets.iterateNext();
  var userUnestimatedTickets = [];
  var leftsuffix = ' left';
  while(thisTicket) {
    
    var estimateFound = false;

    // Add hours listed in the ticket title to the user's total
    if (new RegExp('(\\d+(\\.\\d+)?) *h((ou)?r)?s?' + leftsuffix, 'i').test(thisTicket.innerHTML)) {
      estimateFound = true;
      userHours += parseFloat(RegExp.$1);
    }
    
    // Add minutes too, if they are there
    if (new RegExp('(\\d+(\\.\\d+)?) *m(in(ute)?)?s?' + leftsuffix, 'i').test(thisTicket.innerHTML)) {
      estimateFound = true;
      userHours += parseFloat(RegExp.$1) / 60.0;
    }
    
    // Also add days, converting 1 day to 8 hours
    if (new RegExp('(\\d+(\\.\\d+)?) *d(a?y)?s?' + leftsuffix, 'i').test(thisTicket.innerHTML)) {
      estimateFound = true;
      userHours += parseFloat(RegExp.$1) * 8.0;

      // If the user uses days in their estimates, we assume that they
      // want totals to be displayed using days as well.
      useDays = true;
    }

    if (leftsuffix && !estimateFound) {
      // loop again on same ticket without " left" suffix
      // (yeah, kludgy, I know; this is not a project for long-term investment!)
      leftsuffix = '';
    } else {
      if (!estimateFound) {
        userUnestimatedTickets.push(thisTicket);
      }
      thisTicket = tickets.iterateNext();
      leftsuffix = ' left';
    }
  }

  unestimatedTickets = unestimatedTickets.concat(userUnestimatedTickets);
  
  if (userHours > 0.0) {

    // Format time as desired. Use days as a measurement if the user
    // also used days somewhere.
    timeDisp = formatTime(userHours, useDays);

    // Find ticket list heading
    var heading = document.evaluate('h3/span[contains(@class, "quiet")]', ticketLists.snapshotItem(i), null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

    // Append user's total hours to heading text
    heading.innerHTML += ' - ' + timeDisp + ' left'
        + (userUnestimatedTickets.length == 0 ? '' :
           ' <span style="background-color: yellow;">(but with ' + userUnestimatedTickets.length + ' unestimated tickets)</span>'
           );

    totalHours += userHours;
    if (userHours > maxHours) {
        maxHours = userHours;
        maxHoursUser = document.evaluate(
            'h3/img/@title',
            ticketLists.snapshotItem(i),
            null,
            XPathResult.STRING_TYPE,
            null).stringValue;
    }
  }
}

var milestone_progress = document.evaluate(
    '//div[contains(@class, "greet")]/p[contains(@class, "gmeta")]',
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null).singleNodeValue;

if (milestone_progress !== null && totalHours > 0.0) {
    var totalHoursDisp = formatTime(totalHours, false);
    var maxHoursDisp = formatTime(maxHours, false);
    var maxHoursDispDays = formatTime(maxHours, true);
    var expectedDate = new Date();
    expectedDate.setDate(new Date().getDate() + Math.ceil(maxHours / 8.0));
    var suffix;
    var monthday = expectedDate.getDate();
    if (monthday == 2 || monthday == 22) {
        suffix = 'nd';
    } else if (monthday == 3 || monthday == 23) {
        suffix = 'rd';
    } else if (monthday == 1 || monthday == 21) {
        suffix = 'st';
    } else {
        suffix = 'th';
    }
    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    expectedDateDisp = months[expectedDate.getMonth()] + ' ' + expectedDate.getDate();
    milestone_progress.innerHTML += '<br>Total effort left: ' + totalHoursDisp
        + (unestimatedTickets.length == 0 ? '.' :
           '.<br><span style="background-color: yellow;">Note, though: there are ' + unestimatedTickets.length + ' unestimated tickets!</span>'
           )
        + '<br>Critical path: ' + maxHoursUser
        + ' with ' + maxHoursDisp
        + ' (' + maxHoursDispDays
        + ').<br>Estimated completion: ' + expectedDateDisp + suffix + '.';

    for (var i=0; i < unestimatedTickets.length; i++) {
      unestimatedTickets[i].innerHTML += ' <span style="background-color: yellow;">(no estimate)</span>';
    }

}
