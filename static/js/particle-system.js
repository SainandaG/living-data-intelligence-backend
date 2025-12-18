// Particle System for Data Flow Visualization
export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
    }

    createParticle(from, to, type = 'normal') {
        const geometry = new THREE.SphereGeometry(3, 16, 16);

        const colors = {
            normal: 0x00ff88,
            fraud: 0xff4757,
            warning: 0xffd60a
        };

        const material = new THREE.MeshBasicMaterial({
            color: colors[type] || colors.normal,
            transparent: true,
            opacity: 0.8
        });

        const particle = new THREE.Mesh(geometry, material);
        particle.position.copy(from);

        this.particles.push({
            mesh: particle,
            from: from.clone(),
            to: to.clone(),
            progress: 0,
            speed: 0.01 + Math.random() * 0.01,
            type
        });

        this.scene.add(particle);
    }

    update() {
        this.particles.forEach((particle, index) => {
            particle.progress += particle.speed;

            if (particle.progress >= 1) {
                this.scene.remove(particle.mesh);
                this.particles.splice(index, 1);
            } else {
                particle.mesh.position.lerpVectors(
                    particle.from,
                    particle.to,
                    this.easeInOutCubic(particle.progress)
                );

                // Fade out near end
                if (particle.progress > 0.8) {
                    particle.mesh.material.opacity = (1 - particle.progress) * 4;
                }
            }
        });
    }

    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    clear() {
        this.particles.forEach(particle => {
            this.scene.remove(particle.mesh);
        });
        this.particles = [];
    }
}
