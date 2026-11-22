/**
 * dotvar/config — side-effect import that loads the default `.env` cascade into
 * `process.env`:
 *
 *   import 'dotvar/config';
 *   // or: node --import dotvar/config app.js
 *
 * @packageDocumentation
 */
import { load } from '@libs/node';

load();
