import { db } from './database'
import { createRepository } from './repository'

/** The app-wide repository over the on-device database. */
export const repository = createRepository(db)
export { db }
