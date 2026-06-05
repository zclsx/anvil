import { test, expect } from 'vitest'
import {
  rightPanelReducer,
  initialRightPanelState,
  INSPECTOR_TAB_ID,
  TASK_TAB_ID,
} from '../../src/hooks/useRightPanelTabs'

test.describe('rightPanelReducer', () => {
  test('starts on the task tab', () => {
    expect(initialRightPanelState).toEqual({
      tabs: [{ id: TASK_TAB_ID, kind: 'task' }],
      activeTabId: TASK_TAB_ID,
    })
  })

  test('openInspector creates one inspector tab and reuses it', () => {
    let s = rightPanelReducer(initialRightPanelState, { type: 'openInspector', itemId: 'a' })
    expect(s.tabs).toEqual([
      { id: TASK_TAB_ID, kind: 'task' },
      { id: INSPECTOR_TAB_ID, kind: 'inspector', itemId: 'a' },
    ])
    expect(s.activeTabId).toBe(INSPECTOR_TAB_ID)

    s = rightPanelReducer(s, { type: 'openInspector', itemId: 'b' })
    expect(s.tabs).toHaveLength(2)
    expect(s.tabs[1]).toMatchObject({ kind: 'inspector', itemId: 'b' })
  })

  test('openPreview adds one tab per path and dedupes existing', () => {
    let s = rightPanelReducer(initialRightPanelState, {
      type: 'openPreview',
      filePath: '/ws/a.docx',
      title: 'a.docx',
    })
    expect(s.tabs).toHaveLength(2)
    expect(s.activeTabId).toBe('preview:/ws/a.docx')

    s = rightPanelReducer(s, { type: 'openPreview', filePath: '/ws/b.docx', title: 'b.docx' })
    expect(s.tabs).toHaveLength(3)
    expect(s.activeTabId).toBe('preview:/ws/b.docx')

    s = rightPanelReducer(s, { type: 'openPreview', filePath: '/ws/a.docx', title: 'a.docx' })
    expect(s.tabs).toHaveLength(3)
    expect(s.activeTabId).toBe('preview:/ws/a.docx')
  })

  test('inspector and preview tabs coexist', () => {
    let s = rightPanelReducer(initialRightPanelState, { type: 'openInspector', itemId: 'a' })
    s = rightPanelReducer(s, { type: 'openPreview', filePath: '/ws/r.docx', title: 'r.docx' })
    expect(s.tabs.map((t) => t.kind)).toEqual(['task', 'inspector', 'preview'])
  })

  test('closeTab removes the tab and reassigns active to a neighbor', () => {
    let s = initialRightPanelState
    for (const n of ['a', 'b', 'c']) {
      s = rightPanelReducer(s, { type: 'openPreview', filePath: `/${n}.docx`, title: n })
    }
    expect(s.activeTabId).toBe('preview:/c.docx')

    s = rightPanelReducer(s, { type: 'closeTab', id: 'preview:/c.docx' })
    expect(s.tabs).toHaveLength(3)
    expect(s.activeTabId).toBe('preview:/b.docx')

    s = rightPanelReducer(s, { type: 'closeTab', id: 'preview:/a.docx' })
    expect(s.activeTabId).toBe('preview:/b.docx')
  })

  test('closing the last transient tab returns to task', () => {
    let s = rightPanelReducer(initialRightPanelState, { type: 'openInspector', itemId: 'a' })
    s = rightPanelReducer(s, { type: 'closeTab', id: INSPECTOR_TAB_ID })
    expect(s.tabs).toEqual([{ id: TASK_TAB_ID, kind: 'task' }])
    expect(s.activeTabId).toBe(TASK_TAB_ID)
  })

  test('task tab cannot be closed', () => {
    const s = rightPanelReducer(initialRightPanelState, { type: 'closeTab', id: TASK_TAB_ID })
    expect(s).toEqual(initialRightPanelState)
  })

  test('setActive ignores an unknown tab id', () => {
    const s = rightPanelReducer(initialRightPanelState, { type: 'setActive', id: 'nope' })
    expect(s).toEqual(initialRightPanelState)
  })

  test('followInspector updates an open inspector tab without stealing focus', () => {
    let s = rightPanelReducer(initialRightPanelState, { type: 'openInspector', itemId: 'a' })
    s = rightPanelReducer(s, { type: 'openPreview', filePath: '/r.docx', title: 'r' })
    expect(s.activeTabId).toBe('preview:/r.docx')

    s = rightPanelReducer(s, { type: 'followInspector', itemId: 'b' })
    expect(s.tabs.find((t) => t.id === INSPECTOR_TAB_ID)).toMatchObject({ itemId: 'b' })
    expect(s.activeTabId).toBe('preview:/r.docx')
  })

  test('followInspector is a no-op when no inspector tab is open', () => {
    const s = rightPanelReducer(initialRightPanelState, { type: 'followInspector', itemId: 'a' })
    expect(s).toEqual(initialRightPanelState)
  })

  test('reset returns to task-only state', () => {
    let s = rightPanelReducer(initialRightPanelState, { type: 'openInspector', itemId: 'a' })
    s = rightPanelReducer(s, { type: 'openPreview', filePath: '/r.docx', title: 'r' })
    s = rightPanelReducer(s, { type: 'reset' })
    expect(s).toEqual(initialRightPanelState)
  })
})
