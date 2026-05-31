import { test, expect } from '@playwright/test'
import {
  rightPanelReducer,
  initialRightPanelState,
  INSPECTOR_TAB_ID,
} from '../../src/hooks/useRightPanelTabs'

test.describe('rightPanelReducer', () => {
  test('openInspector creates one inspector tab and reuses it', () => {
    let s = rightPanelReducer(initialRightPanelState, { type: 'openInspector', itemId: 'a' })
    expect(s.tabs).toEqual([{ id: INSPECTOR_TAB_ID, kind: 'inspector', itemId: 'a' }])
    expect(s.activeTabId).toBe(INSPECTOR_TAB_ID)

    s = rightPanelReducer(s, { type: 'openInspector', itemId: 'b' })
    expect(s.tabs).toHaveLength(1)
    expect(s.tabs[0]).toMatchObject({ kind: 'inspector', itemId: 'b' })
  })

  test('openPreview adds one tab per path and dedupes existing', () => {
    let s = rightPanelReducer(initialRightPanelState, {
      type: 'openPreview',
      filePath: '/ws/a.docx',
      title: 'a.docx',
    })
    expect(s.tabs).toHaveLength(1)
    expect(s.activeTabId).toBe('preview:/ws/a.docx')

    s = rightPanelReducer(s, { type: 'openPreview', filePath: '/ws/b.docx', title: 'b.docx' })
    expect(s.tabs).toHaveLength(2)
    expect(s.activeTabId).toBe('preview:/ws/b.docx')

    s = rightPanelReducer(s, { type: 'openPreview', filePath: '/ws/a.docx', title: 'a.docx' })
    expect(s.tabs).toHaveLength(2)
    expect(s.activeTabId).toBe('preview:/ws/a.docx')
  })

  test('inspector and preview tabs coexist', () => {
    let s = rightPanelReducer(initialRightPanelState, { type: 'openInspector', itemId: 'a' })
    s = rightPanelReducer(s, { type: 'openPreview', filePath: '/ws/r.docx', title: 'r.docx' })
    expect(s.tabs.map((t) => t.kind)).toEqual(['inspector', 'preview'])
  })

  test('closeTab removes the tab and reassigns active to a neighbor', () => {
    let s = initialRightPanelState
    for (const n of ['a', 'b', 'c']) {
      s = rightPanelReducer(s, { type: 'openPreview', filePath: `/${n}.docx`, title: n })
    }
    expect(s.activeTabId).toBe('preview:/c.docx')

    s = rightPanelReducer(s, { type: 'closeTab', id: 'preview:/c.docx' })
    expect(s.tabs).toHaveLength(2)
    expect(s.activeTabId).toBe('preview:/b.docx')

    s = rightPanelReducer(s, { type: 'closeTab', id: 'preview:/a.docx' })
    expect(s.activeTabId).toBe('preview:/b.docx')
  })

  test('closing the last tab clears active', () => {
    let s = rightPanelReducer(initialRightPanelState, { type: 'openInspector', itemId: 'a' })
    s = rightPanelReducer(s, { type: 'closeTab', id: INSPECTOR_TAB_ID })
    expect(s.tabs).toHaveLength(0)
    expect(s.activeTabId).toBeNull()
  })

  test('setActive ignores an unknown tab id', () => {
    const s = rightPanelReducer(initialRightPanelState, { type: 'setActive', id: 'nope' })
    expect(s).toEqual(initialRightPanelState)
  })
})
