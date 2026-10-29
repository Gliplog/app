/** The subset of deepmerge 4.3.1's API that this project and its build tools rely on. */
declare function deepmerge<T>(target: Partial<T>, source: Partial<T>, options?: object): T
declare namespace deepmerge {
  function all<T>(objects: object[], options?: object): T
}
export = deepmerge
