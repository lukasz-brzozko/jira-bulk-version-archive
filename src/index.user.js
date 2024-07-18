// ==UserScript==
// @name         Jira Bulk Versions Archive
// @namespace    https://github.com/lukasz-brzozko/jira-bulk-version-archive
// @version      2024-07-18
// @description  Archives bulk of versions at once
// @author       Łukasz Brzózko
// @match        https://jira.nd0.pl/*
// @exclude      https://jira.nd0.pl/plugins/servlet/*
// @icon         https://jira.nd0.pl/s/a3v501/940003/1dlckms/_/images/fav-jsw.png
// @updateURL    https://raw.githubusercontent.com/lukasz-brzozko/jira-bulk-version-archive/main/dist/index.meta.js
// @downloadURL  https://raw.githubusercontent.com/lukasz-brzozko/jira-bulk-version-archive/main/dist/index.user.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const SELECTORS = {
    versionTableRows: "#versions-table > tbody.items.ui-sortable > .js-release",
    rowLink: ".versions-table__name a",
    rowStatus: ".versions-table__status",
    topContainerRow: "table.top-container > tbody > tr",
  };

  const IDS = {
    form: "releases-add__version",
  };

  const MESSAGES = {
    buttonContent: "Archive FrontPortal versions",
    containerFound: `Znaleziono formularz ${IDS.form}`,
    versionCreated: "Created",
    error: {
      basic: "Error",
      containerNotFound: `Nie znaleziono kontenera ${IDS.form}. Skrypt został wstrzymany.`,
    },
  };

  const BASE_URL = "https://jira.nd0.pl/rest/api/2/version/";
  const MAX_REQUESTS = 30;

  let form;

  const linkStyles = async () => {
    const styleTag = document.createElement("style");
    styleTag.textContent = `
      #archive-many-versions-button aui-spinner .aui-spinner.spinner {
        top: auto;
        left: auto;
        transform: none;
        margin-top: 0;
        opacity: 1;
      }

      #archive-many-versions-button aui-spinner .aui-spinner.spinner::before {
        content: none;
      }

      #archive-many-versions-button .aui-button[busy] {
        pointer-events: none;
      }
    `;

    document.body.prepend(styleTag);
  };

  const archiveVersions = async ({ currentTarget }) => {
    currentTarget.busy();

    let counter = 0;

    const rows = [...document.querySelectorAll(SELECTORS.versionTableRows)];

    const payload = JSON.stringify({ archived: true });

    const frontPortalRows = rows.filter((row) => {
      if (counter >= MAX_REQUESTS) {
        return false;
      }

      const name = row.querySelector(SELECTORS.rowLink).textContent;
      const status = row.querySelector(SELECTORS.rowStatus).textContent;

      const isTargetRow =
        name.match(/FrontPortal-/) && status.toLowerCase() !== "archived";

      if (isTargetRow) {
        counter++;
      }

      return isTargetRow;
    });

    await Promise.allSettled(
      frontPortalRows.map((row) => {
        const id = row.dataset.versionId;

        return fetch(`${BASE_URL}${id}`, {
          method: "PUT",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: payload,
        });
      })
    );

    currentTarget.idle();
    window.location.reload();
  };

  const lookForAppContainer = async () => {
    const DOMElements = await new Promise((resolve, reject) => {
      const maxAttempts = 50;
      let attempt = 0;

      const setIntervalId = setInterval(() => {
        form = document.getElementById(IDS.form);
        if (form) {
          clearInterval(setIntervalId);
          window.console.info(
            `%c ${MESSAGES.containerFound}`,
            "background: #B7E1CD; color: #000; font-size: 20px"
          );
          resolve({ container: form });
        } else {
          if (attempt >= maxAttempts) {
            clearInterval(setIntervalId);
            reject({ error: MESSAGES.error.containerNotFound });
          } else {
            attempt++;
          }
        }
      }, 300);
    });

    return DOMElements;
  };

  const handleNavigate = () => {
    if (getIsProjectsPage()) return init();
  };

  const getIsProjectsPage = () => {
    return window.location.pathname.split("/").at(1) === "projects";
  };

  const handleContainerNotFound = () => {
    window.console.error(
      `%c ${MESSAGES.error}`,
      "background: red; color: #fff; font-size: 20px"
    );
  };

  const renderBtn = () => {
    const topContainerRow = document.querySelector(SELECTORS.topContainerRow);

    if (!topContainerRow) return;

    const td = document.createElement("td");
    const button = document.createElement("div");

    button.className = "aui-button";
    button.id = "archive-many-versions-button";
    button.textContent = MESSAGES.buttonContent;
    button.setAttribute("role", "button");

    td.appendChild(button);
    topContainerRow.appendChild(td);

    button.addEventListener("click", archiveVersions);
  };

  const renderUiElements = () => {
    renderBtn();
  };

  const init = async () => {
    try {
      await lookForAppContainer();
    } catch (err) {
      return handleContainerNotFound();
    }

    linkStyles();
    renderUiElements();
  };

  if (getIsProjectsPage()) return init();

  window.navigation.addEventListener("navigate", handleNavigate);
})();
