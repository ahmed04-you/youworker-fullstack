export class SSEClient {
  private controller: AbortController | null = null

  /**
   * Attach an AbortController to the client, aborting any previous stream.
   */
  attach(controller: AbortController) {
    if (this.controller && this.controller !== controller) {
      this.controller.abort()
    }
    this.controller = controller
  }

  /**
   * Abort the active SSE stream if present.
   */
  close() {
    if (this.controller) {
      this.controller.abort()
      this.controller = null
    }
  }

  /**
   * Whether the client currently manages an open stream.
   */
  get isActive() {
    return !!this.controller
  }
}
