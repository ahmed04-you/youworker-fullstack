declare global {
  namespace jest {
    interface MockedFunction<T extends (...args: any[]) => any> {
      new (...args: Parameters<T>): ReturnType<T>
      (...args: Parameters<T>): ReturnType<T>
    }
  }
  
  var describe: (name: string, fn: () => void) => void
  var it: (name: string, fn: () => void) => void
  var test: (name: string, fn: () => void) => void
  var expect: (actual: any) => any
  var beforeEach: (fn: () => void) => void
  var afterEach: (fn: () => void) => void
  var beforeAll: (fn: () => void) => void
  var afterAll: (fn: () => void) => void
  var jest: {
    fn(): jest.MockedFunction<any>
    mock<T extends (...args: any[]) => any>(module: T): jest.Mocked<T>
    doMock<T extends (...args: any[]) => any>(module: T, factory: () => T): jest.Mocked<T>
  }
}

declare module '@testing-library/jest-dom' {
  export * from '@testing-library/jest-dom'
}