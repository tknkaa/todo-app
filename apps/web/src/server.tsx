import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
export { CollaborationRoom } from './durable-object'

export default createStartHandler(defaultStreamHandler)
