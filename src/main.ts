import fs from 'fs';
import path from 'path';
/**
 * Class of reading .env file and set process.env object
 * Methods: evnParser, evnReader
 * evnParser - parse .env file
 * evnReader - read .env file and set process.env
 *
 * @version 1.0.0
 * @since 1.0.0
 */

class Main {
    private obj: any = {};

    /**
     * Parse .env file
     * @param data
     * @returns  object
     */
    private evnParser(data: any): any {
        const lines = data
            .split('\n')
            .map((line: any) => line.replace(/['"]+/g, ''));

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.length === 0 || trimmed.startsWith('#')) {
                continue;
            }

            const [key, value] = trimmed.split('=');
            this.obj[key] = value;
        }

        return this.obj;
    }

    /**
     * Read .env file and set process.env
     * @returns void
     */

    public evnReader(): void {
        const evnPath = path.resolve(process.cwd(), '.env');
        const encoding = 'utf8';

        if (fs.existsSync(evnPath)) {
            const data = this.evnParser(
                fs.readFileSync(evnPath, { encoding: encoding })
            );
            Object.assign(process.env, data);
        }
    }
}

export default Main;
