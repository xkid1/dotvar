/**
 * Class of reading .env file and set process.env object
 * Methods: evnParser, evnReader
 * evnParser - parse .env file
 * evnReader - read .env file and set process.env
 *
 * @version 1.0.0
 * @since 1.0.0
 */

declare module 'js-env' {
    export default class Main {
        private obj: any;
        /**
         * Parse .env file
         * @param data
         * @returns  object
         */
        private evnParser(data: any): any;

        /**
         * Read .env file and set process.env
         * @returns void
         */
        public evnReader(): void;
    }
}
