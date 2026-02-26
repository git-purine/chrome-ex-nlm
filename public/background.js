import { MENU } from "./context-menu.js";

chrome.runtime.onInstalled.addListener((details) => {
  for (const [id, value] of Object.entries(MENU)) {
    // console.info("[ChromeExNLM]", id, value)
    const parent = chrome.contextMenus.create({
      id,
      title: value.title,
      contexts: ["page"],
    });

    if (value.children) {
      for (const [child_id, child_value] of Object.entries(value.children)) {
        chrome.contextMenus.create({
          parentId: parent,
          id: child_id,
          title: child_value.title,
          contexts: ["page"],
        });
      }
    }
  }
});

chrome.contextMenus.onClicked.addListener(async (item, tab) => {
  const menu = findMenu(MENU, item.menuItemId)
  // console.info("[ChromeExNLM]", menu, item, tab)
  const targetTab = await getOrCreateTab(menu.notebook_id)
  console.info("[ChromeExNLM]", "targetTab", targetTab)
  await chrome.scripting.executeScript({
    target: { tabId: targetTab.id },
    func: executeScriptCommand,
    args: [item.pageUrl, menu.command],
  });

  // open(`https://notebooklm.google.com/notebook/${notebook_id}`, item.pageUrl, menu.command);
});

const getOrCreateTab = async (notebook_id, forceCreate) => {
  if (notebook_id) {
    const url = `https://notebooklm.google.com/notebook/${notebook_id}`;
    const tabs = await chrome.tabs.query({});
    // console.info("[ChromeExNLM]", tabs)
    var tab = tabs.find((tab) => tab.url.startsWith(url));
    // console.info("[ChromeExNLM]", tab)
    if (!tab) {
      tab = await chrome.tabs.create({ url, active: false });
    }
    await waitForComplete(tab.id)
    return tab;
  } else {
    var tab = await chrome.tabs.create({ url: "https://notebooklm.google.com/", active: false });
    await waitForComplete(tab.id)
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: executeScriptCreateNotebook,
    });
    return tab
  }
}

const findMenu = (menu, id) => {
  // console.info("[ChromeExNLM]", menu, id)
  for (const key of Object.keys(menu)) {
    // console.info("[ChromeExNLM]", key, id, menu.children)
    if (key === id) {
      return menu[key]
    }

    if (menu[key].children) {
      return findMenu(menu[key].children, id)
    }
  }
};

const executeScriptCreateNotebook = async () => {
  console.info("[ChromeExNLM]", "executeScriptCreateNotebook")

  const waitForSelector = async (document, selector, has = true) => {
    console.info("[ChromeExNLM]", "waitForSelector", selector)
    while (true) {
      const element = document.querySelector(selector);
      console.info("[ChromeExNLM]", "waitForSelector", selector, element)
      if ((has && element) || (!has && !element)) return element;
      await new Promise(r => setTimeout(r, 300));
    }
  }

  const createNewButton = await waitForSelector(document, "div.project-actions-container button.create-new-button");
  console.info("[ChromeExNLM]", "createNewButton", createNewButton)
  if (createNewButton) {
    createNewButton.click();
  }
};

const executeScriptCommand = async (url, command) => {
  console.info("[ChromeExNLM]", "executeScriptCommand", url, command)

  const waitForSelector = async (document, selector, has = true) => {
    console.info("[ChromeExNLM]", "waitForSelector", selector)
    while (true) {
      const element = document.querySelector(selector);
      console.info("[ChromeExNLM]", "waitForSelector", selector, element)
      if ((has && element) || (!has && !element)) return element;
      await new Promise(r => setTimeout(r, 300));
    }
  }
  await waitForSelector(document, "section.source-panel");

  console.info("[ChromeExNLM]", "start executing command")

  const overlayBackdrop = await waitForSelector(document, "div.cdk-overlay-container div.cdk-overlay-backdrop")
  overlayBackdrop.click();

  const sourceTextarea = document.querySelector("section.source-panel textarea");
  const sourceEnterButton = document.querySelector("section.source-panel button.actions-enter-button");
  const chatTextarea = document.querySelector("section.chat-panel textarea");
  const chatSubmitButton = document.querySelector("section.chat-panel button.submit-button");
  console.info("[ChromeExNLM]", sourceTextarea, sourceEnterButton, chatTextarea, chatSubmitButton)

  if (sourceTextarea) {
    sourceTextarea.value += `${url}\n`;
    sourceTextarea.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (sourceEnterButton) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    sourceEnterButton.click();

    await new Promise((resolve) => setTimeout(resolve, 300));
    const scrollArea = document.querySelector("section.source-panel source-picker div.scroll-area-desktop");
    console.info("[ChromeExNLM]", "scrollArea", scrollArea)
    if (scrollArea) {
      while (scrollArea.querySelector("div.single-source-container.shimmer")) {
        console.info("[ChromeExNLM]", "waiting for source to load...")
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  if (command) {
    if (chatTextarea) {
      chatTextarea.value += `${command}\n`;
      chatTextarea.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (chatSubmitButton) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      chatSubmitButton.click();
    }
  }
};

const waitForComplete = async (tabId) => {
  while (true) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === "complete") return;
    await new Promise(r => setTimeout(r, 300));
  }
}


