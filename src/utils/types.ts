export interface ReadingItem {
    url: string
    title: string
    addedAt: string
    category: string
    selectedText?: string
    textPosition?: {
        startOffset: number
        endOffset: number
    }
}