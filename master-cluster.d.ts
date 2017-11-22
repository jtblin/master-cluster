/** Declaration file generated by dts-gen */
import * as cluster from 'cluster';

export function createHttpServer(handler: Function, port: number, onShutdown: Function, onListening: Function): any;

export function run(...args: any[]): void;

export function setFnHandlers(runFn: Function, errorFn: Function): any;

export function setOptions(options: any): any;

export function start(options: any): void;

export { cluster };
