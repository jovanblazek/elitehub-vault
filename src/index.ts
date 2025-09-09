import './utils/environment';
import { db } from './utils/db';

const result = await db.execute('select 1');

console.log(result);
