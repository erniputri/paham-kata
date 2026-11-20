export async function getSelectedTextFromActiveTab() {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!activeTab || !activeTab.id) return "";

  const tabUrl = activeTab.url || "";
  if (
    tabUrl.startsWith("chrome://") ||
    tabUrl.startsWith("chrome-extension://") ||
    tabUrl.startsWith("edge://") ||
    tabUrl.startsWith("about:")
  ) {
    throw new Error("Halaman ini tidak didukung.");
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    // Chrome menserialisasi fungsi ini ke tab, jadi jangan gunakan variabel luar.
    func: () => window.getSelection()?.toString().trim() || "",
  });

  return results?.[0]?.result?.trim() || "";
}
