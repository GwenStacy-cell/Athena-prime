import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

const start = code.indexOf('export async function getServerSecurityEnabledPanel() {');
const end = code.indexOf('async function getSecureDashboardPanel(guild)');

if(start !== -1 && end !== -1) { 
const newPanel = `export async function getServerSecurityEnabledPanel() {
    const section1 = {
        type: 9,
        components: [{
            type: 10,
            content: "<:emoji_16:1533860111704002665> **SERVER SECURITY ENABLED**\\n-# **When server security is enabled these config actions required to from owner/extraowner /whitelist users and Roles**"
        }]
    };

    const section2 = {
        type: 9,
        components: [{
            type: 10,
            content: "<a:warning:1540656124313993247> **\`!wl bot add <bot id>\` - To add bots to server by whitelisted users before that the admin bot comes in either whitelisted to ensure data leaving server owner or extra owner**\\n\\n" +
                     "<a:warning:1540656124313993247> **\`!wl bypass\` - Whitelist users to have securely immunity for the targeted user for whitelisted actions the targeted user is immune for target events**\\n\\n" +
                     "<a:warning:1540656124313993247> **\`!wl invite\` - The Roles can be whitelisted same as users , attempt to get or give whitelisted role to other user by whitelisted user or extra owner will be sent back in error and giver of whitelisted role will be banned**\\n\\n" +
                     "<a:warning:1540656124313993247> **\`!secure dashboard\` - A switch dashboard shows server security status and you can configure action not for action tags in as command**\\n\\n" +
                     "<a:warning:1540656124313993247> **\`#modlog\` - secure a webhook created for logging artifacts**"
        }]
    };

    const section3 = {
        type: 9,
        components: [{
            type: 10,
            content: "**Terms of Service (TOS)**\\n\\n" +
                     "-# **Data Privacy Terms: Athena collects strictly minimal server data (guild ID, role IDs, audit log events, and whitelist settings) solely to operate antinuke security. No personal user messages, DMs, or sensitive personal data are recorded, stored, or shared with any third party.**\\n\\n" +
                     "-# **Non-Exploit Terms: Any attempt to exploit, reverse-engineer, bypass security filters, abuse under-bot privileges, or utilize bot features to disrupt or harm servers is strictly forbidden. Violations result in immediate global blacklisting and permanent loss of security privileges.**"
        }]
    };

    const container = {
        type: 17,
        components: [section1, { type: 14, divider: true }, section2, { type: 14, divider: true }, section3]
    };

    return { components: [container], flags: 1 << 13 };
}

`;
    code = code.substring(0, start) + newPanel + code.substring(end); 
    fs.writeFileSync('src/commands/security.js', code); 
    console.log('Replaced TOS panel successfully!'); 
} else { 
    console.log('Indices not found', start, end); 
}
