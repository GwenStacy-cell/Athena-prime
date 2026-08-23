import fs from 'fs';
let code = fs.readFileSync('src/events/interactionCreate.js', 'utf8');

code = code.replace(`  } catch (error) {
    console.error('Interaction Error:', error);
  }
}

async function handleSecurityInteractions`, `  } catch (error) {
    console.error('Interaction Error:', error);
  }
  }
};

async function handleSecurityInteractions`);

fs.writeFileSync('src/events/interactionCreate.js', code);
