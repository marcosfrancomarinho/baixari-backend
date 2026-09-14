import {createToken} from "../../kit-dev/di/container.js"

export const PATH_PROTOCOL = createToken<string>("PATH_PROTOCOL")
export const PATH_CERTIFICATE = createToken<string>("PATH_CERTIFICATE")