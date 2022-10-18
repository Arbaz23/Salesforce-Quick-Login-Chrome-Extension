var sTabURL = "";
var sDomain = "";
var lsr = 0; // used to determine current start number for existing page by sort
var pageSize = 1000; // max size is 1000

$(function()
{
    chrome.tabs.getSelected(null, function(tab)
    {
        handleSelectedTab(tab.url);
    });

    //button to show all columns
    $("#toggleAllColumns").click(function()
    {
        // Make this a toggle
        if($(".hideColumn").length > 0) {
            $(".hideColumn").removeClass('hideColumn');
            $(this).text("Some Columns");
        } else {
            HideColumns($("table.list"));
            $(this).text("All Columns");
        }
        return false;
    });

    //toggle rows that don't have a Login link available
    $("#quickLoginChrome #toggleLoginAsFilter").change(function(event) {
      var checked = event.target.checked;

      $('td.actionColumn').each(function() {
        var $this = $(this);
        if ( checked && ! $this.hasClass('loginRow') ) {
          $this.parent().hide();
        } else {
          $this.parent().show();
        }
      });
    });

    //handle next/previous page link clicks
    $(document).on("click", "#quickLoginChrome div#navigationButtons a", function() {
      var $ddlView = $("#quickLoginChrome select#fcf");
      if ( $(this).html().toLowerCase().indexOf("next") >= 0 ) {
        lsr += pageSize;
      } else {
        lsr -= pageSize;
      }

      //keep the current users width so the popup window doesn't become skinny when the table
      //is empty and then wide again when the table is reloaded
      $("#users").css("width", $("#users").outerWidth());
      $("#quickLoginChrome #users").empty();
      $("#quickLoginChrome #loading").show();
      RequestUsers($ddlView.val(), lsr);
    });

    AttachFilterHandling();

    function handleSelectedTab(tabUrl)
    {
        sTabURL = tabUrl;
        var hostname = (new URL(tabUrl)).hostname;
        sDomain = 'https://' + hostname;
        RequestUsers("");
    }

    function AttachFilterHandling()
    {
      //case insensitive 'contains'
      jQuery.expr[':'].containsCI = function(a, i, m) {
       return jQuery(a).text().toUpperCase().indexOf(m[3].toUpperCase()) >= 0;
      };

      var typingTimer;
      var doneTypingInterval = 250;

      $("#txtFilter").keyup(function()
      {
        clearTimeout(typingTimer);
        typingTimer = setTimeout(doneTyping, doneTypingInterval);
      });

      function doneTyping ()
      {
        var sFilterText = $("#txtFilter").val();
        $("#spFilterStatus").text("Filtering");
        var $trData = $("div#users table.list tr.dataRow");
        if (sFilterText != "")
        {
          $trData.hide().filter(":containsCI('" + sFilterText + "')").show();
        }
        else
        {
          $trData.show();
        }
        $("#spFilterStatus").text("");
      }
    }

    function RequestUsers(sViewId, startNum)
    {
        //build a url to the Manage Users page so we can get the users html table
        var sFilter = (sViewId !== "") ? "fcf="+sViewId+"&" : "";
        var sLsr = (Number.isInteger(startNum) ? startNum : 0);
        var sUsersPage = sDomain+"/005?isUserEntityOverride=1&"+sFilter+"rowsperpage=" + pageSize + "&lsr=" + sLsr;
        $.get(sUsersPage, function(data)
        {
            html = (new DOMParser()).parseFromString(data, "text/html");

            // Figure out if there are previous/next links so we can provide them in the extension too
            var $navigationButtons = $("#quickLoginChrome #navigationButtons");
            $navigationButtons.empty();
            var first = true;
            $(".listElementBottomNav div.next a", html).each(function() {
              var $this = $(this);
              var href = $this.attr("href");
              $this.attr("href", "#");

              if (!first) {
                $navigationButtons.append(" | ");
              } else {
                first = false;
              }
              $navigationButtons.append($this);
            });

            //remove any images and also the Check All checkbox from the action column header
            $("img, #allBox", html).remove();
            
            // Removing these attributes prevents some errors in the console
            $("tr", html)
            .removeAttr('onblur')
            .removeAttr('onmouseout')
            .removeAttr('onfocus')
            .removeAttr('onmouseover')
            .not(':first')
            .hover(
              function() {
                  $(this).addClass('highlight');
              },
              function() {
                  $(this).removeClass('highlight');
              }
            );

            DisplayUsers(html);
        });
    }

    function HideColumns($table)
    {
        //only show first x columns?
        $("tr", $table).each(function(){
            // use a class so we can hide these while toggling rows on/off
            // This should show name, email and action buttons (if you use
            // a standard layout)
            $(this).children(':gt(3)').addClass('hideColumn');
        });
    }

    function DisplayUsers(data)
    {				
        //reset certain menu controls
        $("#txtFilter").val("");
        $("#toggleLoginAsFilter").attr("checked", false);
        
        //find the view dropdown from the manage users page
        var $ddlView = $("select#fcf", data);
        // Removing these attribute prevents some errors in the console
        $ddlView.removeAttr("onchange");
        $("#viewDropdown").empty().append($ddlView);
        $ddlView.change(function()
        {
            //keep the current users width so the popup window doesn't become skinny when the table
            //is empty and then wide again when the table is reloaded
            $("#users").css("width", $("#users").outerWidth());
            // When we select a new set of users, clear the display
            $("#users").empty();
            $("#loading").show();
            RequestUsers($(this).val());
        });

        var $table = $("div.setupBlock table.list", data);
        HideColumns($table);

        $("#users").append($table);

        //handle login links (https://medium.com/smartbox-engineering/impersonating-salesforce-users-in-test-frameworks-903b7de597c0)
        $("td.actionColumn a[href*=suorgadminid]", $table).each(function()
        {
            $login = $(this);

            //flag the login links and remove other action cell elements (edit link, checkbox)
            $login.addClass("loginLink")
            .parent().addClass("loginRow").html("").append($login);

            //update login url to set target and return URL to the current url
            var sLogin = $login.attr("href");

            //strip off the retURL and targetURL
            var regexRetURL = /(&|\?)retURL=([^&]*)/;
            var regexTargetURL = /(&|\?)targetURL=([^&]*)/;
            sLogin = sLogin.replace(regexRetURL, "");
            sLogin = sLogin.replace(regexTargetURL, "");

            //build our new url with the ret and target urls being the current url we are on
            //so users will go directly to the current page
            sLogin += sLogin.includes('?') ? '&' : '?';
            sLogin += "isUserEntityOverride=1";
            sLogin += "&retURL=" + encodeURIComponent(sTabURL);
            sLogin += "&targetURL=" + encodeURIComponent(sTabURL);

            sLogin = sDomain + sLogin;

            $login.attr("href", sLogin);
        }).click(function() {
            //update the main browser tab (not the popup) and make the main browser tab
            //active which will close the popup
            chrome.tabs.update(null, {url: $(this).attr("href"), active: true});
            window.close();
            return false;
        });

        //update any other links in the table that are not the Login link
        //to be absolute links and open in a new tab so users can still access user detail pages, profile/role pages etc.
        $("a:not('.loginLink')", $table).each(function() {
            var $this = $(this);

            var href = $this.attr('href');
            if (!href.startsWith('https://') && href.startsWith('/')) {
                $this.attr("href", sDomain + href);
            }
            $this.attr("target", "_blank");
        });

        //Clear out action column for users that didn't have login link
        $("td.actionColumn:not('.loginRow')").empty();
        
        $("#toggleAllColumns").text("All Columns");
      
        //uncheck the Show Only Users With Login checkbox on every new load of users
        //since it has to be clicked every time
        //also hide the checkbox option if every user has Login links since the checkbox
        //would not do anything
        if ($("td.actionColumn:not(.loginRow)").length > 0)
        {
          $(".loginUsersOnlyRow").show();
        }
        else
        {
          $(".loginUsersOnlyRow").hide();
        }

        $("#loading").hide();
        $("#menu").show();
        $("#users").css("width", "auto");

        $("#txtFilter").focus();

        //set width of table to try and prevent the popup from squishing the table
        $("body").width("800");
        $table.width($table.outerWidth());
        $("body").width("auto");
    }
});
