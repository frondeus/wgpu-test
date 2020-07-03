use crate::camera::Camera;

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct UniformData {
    view: cgmath::Matrix4<f32>,
    eye: cgmath::Vector4<f32>,
    camera: cgmath::Vector2<f32>,
}

impl From<Camera> for UniformData {
    fn from(camera: Camera) -> Self {
        let view = camera.view_matrix();
        let eye = camera.eye;
        Self {
            eye: cgmath::Vector4::new(eye.x, eye.y, eye.z, 1.0),
            view,
            camera: cgmath::Vector2::new(camera.aspect, camera.fov),
        }
    }
}

impl UniformData {
    pub fn update(&mut self, camera: Camera) {
        let s: Self = camera.into();
        *self = s;
    }
}

unsafe impl bytemuck::Pod for UniformData { }

unsafe impl bytemuck::Zeroable for UniformData { }

