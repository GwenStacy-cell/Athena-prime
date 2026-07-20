import { scanImageForScam } from './src/utils/antiScam.js';

const url = 'https://cdn.discordapp.com/attachments/1526180111756296356/1528218651403092048/image.jpg?ex=6a5ed187&is=6a5d8007&hm=2e4793359ec5c60d608ed2e4f1d86a628171d04f49b23aed8308d39ee69203e2&';

scanImageForScam(url).then(isScam => {
    console.log("--- IS SCAM ---");
    console.log(isScam);
    console.log("---------------");
    process.exit(0);
});
