#[derive(Debug, Copy, Clone)]
pub struct Camera {
    pub(crate) eye: cgmath::Point3<f32>,
    pub(crate) target: cgmath::Point3<f32>,
    pub(crate) up: cgmath::Vector3<f32>,
    pub(crate) aspect: f32,
    pub(crate) fov: f32,
}

impl Camera {
    pub fn new(width: f32, height: f32) -> Self {
        Self {
            eye: (31.0, 11.0, 27.0).into(),
            target: (23.0, 9.0, 20.0).into(),
            up: (0.0, -1.0, 0.0).into(),
            aspect: width / height,
            fov: 45.0
        }
    }

    pub fn resize(&mut self, width: f32, height: f32) {
        self.aspect = width / height;
    }

    pub fn view_matrix(&self) -> cgmath::Matrix4<f32> {
        use cgmath::Matrix;

        cgmath::Matrix4::look_at(self.eye, self.target, self.up).transpose()
    }
}

