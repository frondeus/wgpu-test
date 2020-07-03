use winit::event::VirtualKeyCode;
use crate::camera::Camera;

#[derive(Default)]
pub struct Input {
    speed: f32,
    up: bool,
    down: bool,
    forward: bool,
    backward: bool,
    left: bool,
    right: bool
}

impl Input {
    pub fn new(speed: f32) -> Self {
        Self {
            speed,
            ..Default::default()
        }
    }

    pub fn update_camera(&self, camera: &mut Camera) {
        use cgmath::InnerSpace;
        let forward = (camera.target - camera.eye).normalize();
        if self.forward {
            camera.eye += forward * self.speed;
            camera.target += forward * self.speed;
        }
        if self.backward {
            camera.eye -= forward * self.speed;
            camera.target -= forward * self.speed;
        }

        let up = camera.up;
        let right = forward.cross(camera.up);

        if self.right { camera.target += right * self.speed; }
        if self.left { camera.target -= right * self.speed; }
        if self.down { camera.target += up * self.speed; }
        if self.up { camera.target -= up * self.speed; }
    }

    pub fn update(&mut self, pressed: bool, code: VirtualKeyCode) {
        match code {
            VirtualKeyCode::Space => { self.forward = pressed; },
            VirtualKeyCode::LShift => { self.backward = pressed; },
            VirtualKeyCode::W | VirtualKeyCode::Up => { self.up = pressed; },
            VirtualKeyCode::S | VirtualKeyCode::Down => { self.down = pressed; },
            VirtualKeyCode::A | VirtualKeyCode::Left => { self.left = pressed; },
            VirtualKeyCode::D | VirtualKeyCode::Right => { self.right = pressed; },
            _ => {}
        }
    }
}
