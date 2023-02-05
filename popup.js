var sTabURL = "";
var sDomain = "";
var lsr = 0; // used to determine current start number for existing page by sort
var pageSize = 1000; // max size is 1000

document.addEventListener("DOMContentLoaded", () => {
  function localizeHtmlPage (elm) {
    const messageRegex = /__MSG_(\w+)__/g;

    for (var i = 0; i < elm.children.length; i++) {
      localizeHtmlPage(elm.children[i]);
      if (elm.children[i].hasAttributes()) {
        for (var j = 0; j < elm.children[i].attributes.length; j++) {
          elm.children[i].attributes[j].name = elm.children[i].attributes[j].name.replace(messageRegex, localizeString);
          elm.children[i].attributes[j].value = elm.children[i].attributes[j].value.replace(messageRegex, localizeString);
        }
      }
      if (elm.children[i].innerHTML.length) {
        elm.children[i].innerHTML = elm.children[i].innerHTML.replace(messageRegex, localizeString);
      }
    }
  }

  function localizeString(_, str) {
    return str ? chrome.i18n.getMessage(str) : "";
  }

  localizeHtmlPage(document.body);

  chrome.tabs.query({active: true, lastFocusedWindow: true}, function(tabs) {
    handleSelectedTab(tabs[0].url);
  });

  //button to show all columns
  document.getElementById("toggleAllColumns").addEventListener("click", (e) => {
    // Make this a toggle
    if(document.querySelectorAll(".hideColumn").length > 0) {
      document.querySelectorAll(".hideColumn").forEach((el) => {
        el.classList.remove("hideColumn");
      });
      e.target.innerText = chrome.i18n.getMessage("popupShowSomeColumns");
    } else {
      hideColumns(document.querySelector("table.list"));
      e.target.innerText = chrome.i18n.getMessage("popupShowAllColumns");
    }
  });

  //toggle rows that don't have a Login link available
  document.getElementById("toggleLoginAsFilter").addEventListener("change", (event) => {
    let checked = event.target.checked;

    document.querySelectorAll('td.actionColumn').forEach((column) => {
      if ( checked && ! column.classList.contains('loginRow') ) {
        column.parentElement.style.display = "none";
      } else {
        column.parentElement.style.display = "table-row";
      }
    });
  });

  //handle next/previous page link clicks
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#quickLoginChrome div#navigationButtons a")) return;

    const ddlView = document.querySelector("#quickLoginChrome select#fcf");
    const navigationButton = event.target;
    if (navigationButton.innerHTML.toLowerCase().includes("next")) {
      lsr += pageSize;
    } else {
      lsr -= pageSize;
    }

    //keep the current users width so the popup window doesn't become skinny when the table
    //is empty and then wide again when the table is reloaded
    const users = document.querySelector("#users");
    users.style.width = `${users.offsetWidth}px`;
    document.getElementById("users").innerHTML = "";
    document.getElementById("loading").style.display = "block";
    requestUsers(ddlView.value, lsr);
  });

  attachFilterHandling();

  function handleSelectedTab(tabUrl) {
      sTabURL = tabUrl;
      let hostname = (new URL(tabUrl)).hostname;
      sDomain = `https://${hostname}`;
      requestUsers("");
  }

  function attachFilterHandling() {
    let typingTimer;
    const doneTypingInterval = 250;

    document.getElementById("txtFilter").addEventListener("keyup", () => {
      clearTimeout(typingTimer);
      typingTimer = setTimeout(doneTyping, doneTypingInterval);
    });

    const doneTyping = () => {
      const sFilterText = document.getElementById("txtFilter").value;
      document.getElementById("spFilterStatus").textContent = "Filtering";
      const trData = document.querySelectorAll("div#users table.list tr.dataRow");

      if (sFilterText != "") {
        Array.from(trData).forEach((el) => {
          if(el.textContent.toUpperCase().includes(sFilterText.toUpperCase())) {
            el.style.display = "table-row";
          } else {
            el.style.display = "none";
          }
        });
      } else {
        trData.forEach(el => el.style.display = "table-row");
      }
      document.getElementById("spFilterStatus").textContent = "";
    }
  }

  async function requestUsers(sViewId, startNum) {
    //build a url to the Manage Users page so we can get the users html table
    const sFilter = sViewId !== "" ? `fcf=${sViewId}&` : "";
    const sLsr = Number.isInteger(startNum) ? startNum : 0;
    const sUsersPage = `${sDomain}/005?isUserEntityOverride=1&${sFilter}rowsperpage=${pageSize}&lsr=${sLsr}`;
    
    const response = await fetch(sUsersPage);
    const data = await response.text();
    
    const parser = new DOMParser();
    const html = parser.parseFromString(data, "text/html");

     // Figure out if there are previous/next links so we can provide them in the extension too
    let navigationButtons = document.querySelector('#quickLoginChrome #navigationButtons');
    navigationButtons.innerHTML = '';

    const nextLinks = html.querySelectorAll('.listElementBottomNav div.next a');
    Array.from(nextLinks).forEach((link, index) => {
      link.href = '#';
      if (index != 0) {
        navigationButtons.innerHTML += ' | ';
      }
      navigationButtons.appendChild(link);
    });
    
    // remove any images and also the Check All checkbox from the action column header
    const images = html.querySelectorAll('img');
    for (const img of images) {
      img.remove();
    }
    const allBox = html.querySelector('#allBox');
    if (allBox) {
      allBox.remove();
    }

    // Removing these attributes prevents some errors in the console
    const rows = html.querySelectorAll('tr');
    for (const row of rows) {
      row.removeAttribute('onblur');
      row.removeAttribute('onmouseout');
      row.removeAttribute('onfocus');
      row.removeAttribute('onmouseover');
      if (row !== rows[0]) {
        row.addEventListener('mouseenter', () => row.classList.add('highlight'));
        row.addEventListener('mouseleave', () => row.classList.remove('highlight'));
      }
    }
    displayUsers(html);
  }

  function hideColumns(table) {
    Array.from(table.getElementsByTagName('tr')).forEach((row) => {
      for (let i = 3, col; col = row.cells[i]; i++) {
        col.classList.add('hideColumn');
      }
    });
  }

  function displayUsers(data) {				
      //reset certain menu controls
      document.getElementById("txtFilter").value = "";
      document.getElementById("toggleLoginAsFilter").checked = false;
      
      //find the view dropdown from the manage users page
      let ddlView = data.querySelector("select#fcf");
      // Removing these attribute prevents some errors in the console
      ddlView.removeAttribute("onchange");

      let viewDropdown = document.getElementById("viewDropdown");
      viewDropdown.innerHTML = "";
      viewDropdown.appendChild(ddlView);
      
      ddlView.addEventListener("change", () => {
        //keep the current users width so the popup window doesn't become skinny when the table
        //is empty and then wide again when the table is reloaded
        let users = document.getElementById("users");
        users.style.width = users.offsetWidth + "px";
        // When we select a new set of users, clear the display
        users.innerHTML = "";
        document.getElementById("loading").style.display = "block";
        requestUsers(ddlView.value);
      });

      let table = data.querySelector("div.setupBlock table.list");
      hideColumns(table);

      document.getElementById("users").appendChild(table);

      //handle login links (https://medium.com/smartbox-engineering/impersonating-salesforce-users-in-test-frameworks-903b7de597c0)
      let loginLinks = table.querySelectorAll("td.actionColumn a[href*=suorgadminid]");
      Array.from(loginLinks).forEach(loginLink => {
        let login = loginLink.cloneNode(true);

        //flag the login links and remove other action cell elements (edit link, checkbox)
        login.classList.add("loginLink");

        let parentElement = loginLink.parentElement;
        parentElement.classList.add("loginRow");
        parentElement.innerHTML = "";
        parentElement.appendChild(login);

        //update login url to set target and return URL to the current url
        let sLogin = login.getAttribute("href");

        //strip off the retURL and targetURL
        let regexRetURL = /(&|\?)retURL=([^&]*)/;
        let regexTargetURL = /(&|\?)targetURL=([^&]*)/;
        sLogin = sLogin.replace(regexRetURL, "");
        sLogin = sLogin.replace(regexTargetURL, "");

        //build our new url with the ret and target urls being the current url we are on
        //so users will go directly to the current page
        sLogin += sLogin.includes("?") ? "&" : "?";
        sLogin += "isUserEntityOverride=1";
        sLogin += "&retURL=" + encodeURIComponent(sTabURL);
        sLogin += "&targetURL=" + encodeURIComponent(sTabURL);
        sLogin = sDomain + sLogin;
        login.setAttribute("href", sLogin);

        login.addEventListener("click", (e) => {
          //update the main browser tab (not the popup) and make the main browser tab
          //active which will close the popup
          chrome.tabs.update(null, {url: e.target.getAttribute("href"), active: true});
          window.close();
        });
      });

      //update any other links in the table that are not the Login link
      //to be absolute links and open in a new tab so users can still access user detail pages, profile/role pages etc.
      table.querySelectorAll("a:not(.loginLink)").forEach((e) => {
        var href = e.getAttribute('href');
        if (!href.startsWith('https://') && href.startsWith('/')) {
          e.setAttribute("href", sDomain + href);
        }
        e.setAttribute("target", "_blank");
      });

      //Clear out action column for users that didn't have login link
      document.querySelectorAll("td.actionColumn:not(.loginRow)").forEach((e) => {
        e.innerHTML = "";
      });
      
      document.getElementById("toggleAllColumns").innerText = chrome.i18n.getMessage("popupShowAllColumns");
    
      //uncheck the Show Only Users With Login checkbox on every new load of users
      //since it has to be clicked every time
      //also disbale the checkbox option if every user has Login links since the checkbox
      //would not do anything
      let actionColumns = Array.from(document.querySelector("td.actionColumn:not(.loginRow)"));
      if (actionColumns.length > 0) {
        document.getElementById("toggleLoginAsFilter").disabled = true;
      }
      else
      {
        document.getElementById("toggleLoginAsFilter").disabled = false;
      }

      document.getElementById("loading").style.display = "none";
      document.getElementById("menu").style.display = "block";
      document.getElementById("users").style.width = "auto";

      document.getElementById("txtFilter").focus();

      //set width of table to try and prevent the popup from squishing the table
      document.querySelector("body").style.width = "800px";
      //table.style.width = table.offsetWidth + "px";
      table.style.width = "100%";
      table.style.width = table.offsetWidth + "px";
      document.querySelector("body").style.width = "auto";
  }
});
