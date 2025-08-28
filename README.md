# 🛹 Skate Ball Smash

A modern HTML5 canvas-based breakout game with a skateboard theme, featuring progressive difficulty, power-ups, and responsive design.

![Game Preview](favicon.png)

## 🎮 Game Features

### Core Gameplay
- **10 Progressive Levels** - Each with unique block patterns and increasing difficulty
- **Dynamic Ball Physics** - Realistic bouncing with paddle spin control
- **Aiming System** - Visual aiming line with click/tap to launch
- **Combo System** - Score multipliers for consecutive hits
- **Speed Selection** - Choose from Slow, Normal, or Fast ball speeds

### Power-ups & Effects
- **Rocket Power-up** - Auto-firing bullets to destroy blocks
- **Particle Effects** - Colorful burst effects on block destruction
- **Hit Effects** - Realistic block damage with visual feedback
- **3D Block Styling** - Gradient shading and depth effects

### Level Patterns
- **Simple** - Basic rectangular formations
- **Rows** - Alternating row patterns
- **Checkerboard** - Chess-like arrangements
- **Diamond** - Diamond-shaped formations
- **Cross** - Cross and diagonal patterns
- **Spiral** - Spiral formations
- **Fortress** - Defensive wall structures
- **Maze** - Complex maze-like patterns
- **Pyramid** - Triangular pyramid shapes
- **Chaos** - Procedurally generated chaos patterns

## 🎯 Controls

### Desktop
- **Mouse Movement** - Control paddle and aim ball
- **Left Click** - Launch ball when aiming
- **Right Click** - Access browser context menu/developer tools
- **Space/P** - Pause/unpause game

### Mobile
- **Touch & Drag** - Control paddle and aim ball
- **Tap** - Launch ball when aiming
- **Touch Controls** - Fully responsive touch interface

## 🚀 Technical Features

### Performance Optimizations
- **Object Pooling** - Efficient memory management for bullets, meteors, and particles
- **DPR-Aware Rendering** - Crisp graphics on high-DPI displays
- **Smooth Animations** - 60fps gameplay with optimized rendering
- **Responsive Canvas** - Automatic scaling for all screen sizes

### Cross-Platform Support
- **Desktop Optimized** - Fixed 600px game area for consistent gameplay
- **Mobile Responsive** - Full-width layout with touch controls
- **Progressive Enhancement** - Works on all modern browsers

### Advanced Input System
- **Boundary Detection** - Cursor only controls game within play area
- **Multi-Input Support** - Mouse, touch, and keyboard controls
- **Precise Aiming** - Angle-constrained ball launching system

## 📁 Project Structure

```
game/
├── index.html          # Main HTML file
├── styles.css          # Game styling and responsive design
├── game.js            # Core game logic and rendering
├── favicon.png        # Game icon
├── nn.png            # Additional asset
└── README.md         # This file
```

## 🛠️ Setup & Installation

### Quick Start
1. **Clone or download** the project files
2. **Open `index.html`** in any modern web browser
3. **Start playing!** No build process or dependencies required

### Local Development
```bash
# Optional: Serve with a local server for testing
python -m http.server 8000
# or
npx serve .
```

## 🎨 Customization

### Speed Settings
The game includes three speed presets:
- **Slow**: 0.7x speed multiplier
- **Normal**: 1.0x speed multiplier (default)
- **Fast**: 1.4x speed multiplier

### Level Configuration
Each level has configurable properties:
```javascript
{
  pattern: 'diamond',     // Block arrangement pattern
  hp: 3,                 // Block health points
  ballSpeed: 1.3,        // Speed multiplier for this level
  meteorChance: 0.22     // Chance of meteor effects
}
```

### Visual Themes
The game uses CSS custom properties for easy theming:
```css
:root {
  --bg: #0b0e14;        /* Background color */
  --accent: #3bd1ff;    /* Accent color */
  --good: #60ff9f;      /* Success color */
  --warn: #ffcc66;      /* Warning color */
  --danger: #ff6b6b;    /* Danger color */
}
```

## 🏆 Scoring System

- **Block Destruction**: 10 points base score
- **Bullet Hits**: 6 points per hit
- **Meteor Hits**: 12 points per hit
- **Combo Multiplier**: Up to 8x for consecutive hits
- **Time-based Combos**: 1.4 second window for combo chains

## 📱 Browser Compatibility

- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 12+
- ✅ Edge 79+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## 🔧 Technical Requirements

- **HTML5 Canvas** support
- **ES6+ JavaScript** features
- **CSS Grid & Flexbox** support
- **Touch Events** API (for mobile)
- **Local Storage** (for saving preferences)

## 🎯 Game Mechanics

### Ball Physics
- Realistic bouncing with velocity preservation
- Paddle hit position affects ball angle
- Wall collision detection and response
- Gravity-free environment for consistent gameplay

### Block System
- Health-based destruction (1-6 HP depending on level)
- Visual damage indicators (color changes, cracks)
- Standardized behavior across all blocks
- Progressive difficulty scaling

### Power-up System
- 5% drop chance from destroyed blocks
- Limited to 3 power-ups per game session
- 6-second rocket duration
- Automatic bullet firing at 120ms intervals

## 🌟 Credits

**Developed by**: Nkosi  
**Framework**: Vanilla HTML5/CSS3/JavaScript  
**Design**: Modern responsive web design  
**Theme**: Skateboard-inspired breakout game  

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

**Enjoy playing Skate Ball Smash!** 🎮✨

For issues, suggestions, or contributions, feel free to open an issue or submit a pull request.
