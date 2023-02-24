# js-env

<div align="center">
<img align="left" alt="JavaScript" width="26px" src="https://raw.githubusercontent.com/github/explore/e94815998e4e0713912fed477a1f346ec04c3da2/topics/javascript/javascript.png" />
<img align="left" alt="Node>js" width="26px" src="https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/nodejs/nodejs.png" />
</div>

Js-env is a lightweight module that loads all the environment variables from a `.env` then add into the procees.env.

# Install

`npm i js-env`

```bash
import jsEnv from 'js-env';
```

Or installing with `yarn add dotenv`

## Usage

```dosini
S3_BUCKET="s3_bucket"
SECRET_KEY="secret key"
```

```javascript
require('js-env').evnReader()
console.log(process.env) // Check if working.
```

.. or using ES6

```javascript
import jsenv from 'js-env' 
jsenv.evnReader()

```

## Examples 

Languages frameworks can use.

* nodejs
* typescript
* react
* react (typescript)
* express
* nestjs
* webpack