import { describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { ExternalLinkGuard } from "./external-link-guard"

// web 模式（jsdom 下 globalThis.isTauri 未定义）→ isTauri() 返回 false，
// openExternalLink 走 window.open 兜底，外链不再是死链。
describe("ExternalLinkGuard · web 模式外链", () => {
  it("拦截外链并走 window.open 打开", () => {
    const openSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null)

    render(<ExternalLinkGuard />)

    const anchor = document.createElement("a")
    anchor.href = "https://example.com"
    anchor.textContent = "外部链接"
    document.body.appendChild(anchor)

    fireEvent.click(anchor)

    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/",
      "_blank",
      "noopener,noreferrer"
    )

    openSpy.mockRestore()
    cleanup()
  })
})
