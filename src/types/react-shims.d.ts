// [임시 파일] 샌드박스 환경에 네트워크가 없어 @types/react 패키지를
// 설치하지 못했을 때 tsc 타입 체크를 통과시키기 위한 최소 선언입니다.
// (런타임 동작에는 영향 없음 — esbuild는 타입을 검사하지 않고 제거합니다)
//
// 실제 개발 PC에서 `npm install`로 @types/react, @types/react-dom이
// 정상 설치되면 이 파일을 삭제하세요. 삭제하지 않으면 실제 타입 선언과
// 충돌(중복 선언 오류)이 발생할 수 있습니다.

declare module "react" {
  export function useState<T>(initial: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useMemo<T>(factory: () => T, deps: any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps: any[]): T;
  export function useRef<T>(initial: T): { current: T };
  export function createElement(...args: any[]): any;
  const React: any;
  export default React;
}

declare module "react/jsx-runtime" {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module "react-dom/client" {
  export function createRoot(container: Element | DocumentFragment): {
    render(children: any): void;
    unmount(): void;
  };
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
  interface Element {}
}
