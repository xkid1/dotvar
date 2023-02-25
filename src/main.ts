import fs from 'fs';
import path from 'path';

export interface IOptions {
    [key: string]: string;
}
/**
 * Parse .env file
 * @param data
 * @returns  object
 */
const parser = (data: string): IOptions => {
    const obj: IOptions = {};
    const lines = data
        .split('\n')
        .map((line: any) => line.replace(/['"]+/g, ''));

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0 || trimmed.startsWith('#')) {
            continue;
        }
        const [key, value] = trimmed.split('=');
        obj[key] = value;
    }

    return obj;
};

/**
 * Read .env file and set process.env
 * @returns void
 */
const read = (): void => {
    try {
        const evnPath = path.resolve(process.cwd(), '.env');
        const encoding = 'utf8';
        if (fs.existsSync(evnPath)) {
            const data = parser(fs.readFileSync(evnPath, { encoding }));

            Object.keys(data).forEach((key: string) => {
                if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
                    process.env[key] = data[key];
                }
            });
        }
    } catch (error) {
        switch (error.code) {
            case 'ENOENT':
                console.log('File not found!');
                break;
            case 'EACCES':
                console.log('Permission denied!');
                break;
            default:
                console.log('Unknown error: ' + error.code);
        }
    }
};

module.exports.read = read;
