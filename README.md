## Setup

- Setup keys in .env

- Start Chrome with the custom `chrome-profile-data` folder from this project.

You can do it with a command similar to this one.

```
  google-chrome \
   --remote-debugging-port=9223 \
   --user-data-dir="./chrome-profile-data"
```

- Create a new profile

- Install Metamask

- Import test account to Metamask (if you have one)

- Send funds to your account (EURG in our case) + some ETH for gas

- Add agent profile in `./profiles.ts`

## Usage

`npm run agent -- Scully`
