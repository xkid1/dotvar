# dotvar

<div align="center">
    <span><img  src="https://raw.githubusercontent.com/github/explore/e94815998e4e0713912fed477a1f346ec04c3da2/topics/javascript/javascript.png" alt="JavaScript" width="26px"></span>
    <span><img  src="https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/nodejs/nodejs.png"  alt="Node>js" width="26px" ></span>
     <span><img  src="https://raw.githubusercontent.com/motdotla/dotenv/master/dotenv.svg"  alt="dotenv" width="26px" ></span>
<hr>
</div>


[![Create Release](https://github.com/xkid1/dotvar/actions/workflows/release-tag.yml/badge.svg)](https://github.com/xkid1/dotvar/actions/workflows/release-tag.yml)
[![publish](https://github.com/xkid1/dotvar/actions/workflows/publish.yml/badge.svg)](https://github.com/xkid1/dotvar/actions/workflows/publish.yml)
[![LICENSE](https://img.shields.io/github/license/xkid1/dotvar.svg)](LICENSE)

Dotvar is a lightweight and no dependecry module that loads all the environment variables from a `.env` then add into the procees.env.

# Install

`npm i dotvar`

```bash
import dotvar from 'dotvar';
```

Or installing with `yarn add dotvar`

## Usage

```dosini
S3_BUCKET="s3_bucket"
SECRET_KEY="secret key"
```

```javascript
require('dotvar').evnReader()
console.log(process.env) // Check if working.
```

.. or using ES6

```javascript
import dotvar from 'dotvar' 
dotvar.read()

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

## Status
| Project               | Status                                                       | Description                                             |
| --------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| [dotvar]              | [![dotvar-status]][dotvar-package]                             | Environment variables from .evn                         |

[dotvar]: https://github.com/xkid1/dotvar
[dotvar-package]: https://www.npmjs.com/package/dotvar
[dotvar-status]: https://img.shields.io/npm/v/dotvar