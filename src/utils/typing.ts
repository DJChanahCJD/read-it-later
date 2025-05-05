interface ReadingItem {
    url: string
    title: string
    addedAt: string
    category: string
    position?: ReadingPosition
}

interface ReadingPosition {
    url: string
    position: number
}

type Tab = chrome.tabs.Tab


export {
    ReadingItem,
    ReadingPosition,
    Tab
}