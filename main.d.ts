export interface IOptions {
    [key: string]: string;
}

/**
 * Reading .env file and set process.env object
 * Methods: evnParser, evnReader
 * evnParser - parse .env file
 * evnReader - read .env file and set process.env
 *
 * @version 1.0.0
 * @since 1.0.0
 */
declare module 'dotvar' {
    /**
     * Parse .env file
     * @param src
     * @returns  object
     */
    function parser<T extends IOptions>(src: string): T;

    /**
     * Read .env file and set to process.env
     * @returns void
     */

    export function read(): void;
}
