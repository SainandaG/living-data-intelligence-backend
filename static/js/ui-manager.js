/**
 * UI Manager
 * Handles sliding screen transitions and view state management.
 */
export class UIManager {
    constructor() {
        this.currentView = 'dashboard';
        this.views = ['dashboard', 'graph', 'ai', 'settings'];
        this.sidebarItems = document.querySelectorAll('.sidebar-item');

        this.init();
    }

    init() {
        console.log("🚀 UI Manager Initializing...");
        const start = () => {
            this.sidebarItems = document.querySelectorAll('.sidebar-item');
            console.log(`Found ${this.sidebarItems.length} sidebar items`);

            this.sidebarItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    const viewId = item.getAttribute('data-view');
                    console.log(`🖱️ Sidebar Item Clicked: ${viewId}`);
                    if (viewId) this.switchView(viewId);
                });
            });

            // Initialize default view
            this.switchView('dashboard');
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start);
        } else {
            start();
        }
    }

    switchView(viewId) {
        if (!this.views.includes(viewId)) return;

        // update active state in sidebar
        this.sidebarItems.forEach(item => {
            if (item.getAttribute('data-view') === viewId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Slide logic
        const contentContainer = document.getElementById('main-content-slider');
        const viewIndex = this.views.indexOf(viewId);

        // Assuming each view is 100% width, translate the container
        if (contentContainer) {
            contentContainer.style.transform = `translateX(-${viewIndex * 25}%)`; // 4 screens = 100/4 = 25%? No.
            // Actually, if container width is 400vw, then each screen is 100vw.
            // Translate is -0vw, -100vw, -200vw...
            // But usually easier to translate by percentage of the CONTAINER width if views are stacked.
            // Let's assume container is 400% width.
            contentContainer.style.transform = `translateX(-${viewIndex * 25}%)`;
        }

        this.currentView = viewId;
        console.log(`UI: Switched to ${viewId}`);

        // Trigger specific view logic
        if (viewId === 'graph') {
            window.dispatchEvent(new Event('resize')); // Trigger Three.js resize
        }
    }
}
