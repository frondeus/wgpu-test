use winit::{
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoop},
    window::Window
};
use anyhow::{Result, anyhow};
use winit::event::{KeyboardInput, ElementState, VirtualKeyCode};

mod camera;
mod uniform;

mod input;

use camera::Camera;
use uniform::UniformData;
use input::Input;

async fn run(events: EventLoop<()>, window: Window, swapchain_format: wgpu::TextureFormat) -> Result<()> {
    let size = window.inner_size();
    let surface =  wgpu::Surface::create(&window) ;
    let adapter = wgpu::Adapter::request(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::Default,
            compatible_surface: Some(&surface)
        }, wgpu::BackendBit::PRIMARY)
    .await.ok_or_else(|| anyhow!("Couldn't find adapter"))?;

    let (device, queue) = adapter.request_device(&wgpu::DeviceDescriptor {
        extensions: wgpu::Extensions {
            anisotropic_filtering: false
        },
        limits: Default::default()
    }).await;

    let vs = include_bytes!("../shaders/shader.vert.spv");
    let vs_module = device.create_shader_module(&wgpu::read_spirv(std::io::Cursor::new(&vs[..]))?);

    let fs = include_bytes!("../shaders/shader.frag.spv");
    let fs_module = device.create_shader_module(&wgpu::read_spirv(std::io::Cursor::new(&fs[..]))?);

    let mut camera = Camera::new(size.width as f32, size.height as f32);
    let mut uniforms: UniformData = camera.into();
    let mut input = Input::new(0.2);

    let uniform_buffer = device.create_buffer_with_data(
        bytemuck::cast_slice(&[uniforms]),
        wgpu::BufferUsage::UNIFORM | wgpu::BufferUsage::COPY_DST
    );

    let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
        bindings: &[
            wgpu::BindGroupLayoutEntry {
                binding: 0,
                visibility: wgpu::ShaderStage::VERTEX | wgpu::ShaderStage::FRAGMENT,
                ty: wgpu::BindingType::UniformBuffer {
                    dynamic: false
                }
            }
        ],
        label: Some("uniform_bind_group_layout")
    });

    let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
        layout: &bind_group_layout,
        bindings: &[
            wgpu::Binding {
                binding: 0,
                resource: wgpu::BindingResource::Buffer {
                    buffer: &uniform_buffer,
                    range: 0..std::mem::size_of_val(&uniforms) as wgpu::BufferAddress
                }
            }
        ],
        label: Some("uniform_bind_group")
    });

    let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
        bind_group_layouts: &[&bind_group_layout],
    });

    let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
        layout: &pipeline_layout,
        vertex_stage: wgpu::ProgrammableStageDescriptor { module: &vs_module, entry_point: "main" },
        fragment_stage: Some(wgpu::ProgrammableStageDescriptor { module: &fs_module, entry_point: "main" }),
        rasterization_state: Some(wgpu::RasterizationStateDescriptor {
            front_face: wgpu::FrontFace::Ccw,
            cull_mode: wgpu::CullMode::None,
            depth_bias: 0,
            depth_bias_slope_scale: 0.0,
            depth_bias_clamp: 0.0
        }),
        primitive_topology: wgpu::PrimitiveTopology::TriangleList,
        color_states: &[wgpu::ColorStateDescriptor {
            format: swapchain_format,
            color_blend: wgpu::BlendDescriptor::REPLACE,
            alpha_blend: wgpu::BlendDescriptor::REPLACE,
            write_mask: wgpu::ColorWrite::ALL
        }],
        depth_stencil_state: None,
        vertex_state: wgpu::VertexStateDescriptor {
            index_format: wgpu::IndexFormat::Uint16,
            vertex_buffers: &[]
        },
        sample_count: 1,
        sample_mask: 0,
        alpha_to_coverage_enabled: false
    });

    let mut sc_desc = wgpu::SwapChainDescriptor {
        usage: wgpu::TextureUsage::OUTPUT_ATTACHMENT,
        format: swapchain_format,
        width: size.width,
        height: size.height,
        present_mode: wgpu::PresentMode::Mailbox
    };

    let mut swap_chain = device.create_swap_chain(&surface, &sc_desc);

    events.run(move |event, _, control_flow| {
       *control_flow = ControlFlow::Poll;
        match event {
            Event::MainEventsCleared => window.request_redraw(),
            Event::WindowEvent { event: WindowEvent::Resized(size), .. } => {
                sc_desc.width = size.width;
                sc_desc.height = size.height;
                swap_chain = device.create_swap_chain(&surface, &sc_desc);
                camera.resize(size.width as f32, size.height as f32);
            }
            Event::RedrawRequested(_) => {
                // Update
                input.update_camera(&mut camera);
                uniforms.update(camera);
                let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: None
                });

                let staging_buffer = device.create_buffer_with_data(
                    bytemuck::cast_slice(&[uniforms]),
                    wgpu::BufferUsage::COPY_SRC
                );

                encoder.copy_buffer_to_buffer(&staging_buffer, 0, &uniform_buffer, 0,
                                              std::mem::size_of::<UniformData>()
                                                  as wgpu::BufferAddress
                );

                queue.submit(&[encoder.finish()]);

                // Render
                let frame = swap_chain.get_next_texture().unwrap();
                let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: None
                });
                {
                    let mut rpass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                        color_attachments: &[wgpu::RenderPassColorAttachmentDescriptor {
                            attachment: &frame.view,
                            resolve_target: None,
                            load_op: wgpu::LoadOp::Clear,
                            store_op: wgpu::StoreOp::Store,
                            clear_color: wgpu::Color::GREEN
                        }],
                        depth_stencil_attachment: None
                    });

                    rpass.set_pipeline(&render_pipeline);
                    rpass.set_bind_group(0, &bind_group, &[]);
                    rpass.draw(0 .. 6, 0 .. 1);
                }

                queue.submit(&[encoder.finish()]);
            }
            Event::WindowEvent { event: WindowEvent::KeyboardInput {  input: KeyboardInput {  state: ElementState::Pressed, virtual_keycode: Some(VirtualKeyCode::Escape), ..}, .. }, .. }
            | Event::WindowEvent { event: WindowEvent::CloseRequested, .. } => {
                *control_flow = ControlFlow::Exit;
            },
            Event::WindowEvent { event: WindowEvent::KeyboardInput { input: KeyboardInput { state, virtual_keycode: Some(keycode), ..}, .. }, ..} => {
                let is_pressed = state == ElementState::Pressed;
                input.update(is_pressed, keycode);
            }
            _ => ()
        }
    })
}

fn main() -> Result<()> {
    let event_loop = EventLoop::new();
    let window = winit::window::Window::new(&event_loop)?;
    window.set_title("Ray marching test");
    env_logger::init();
    futures::executor::block_on(async {
        run(event_loop, window, wgpu::TextureFormat::Bgra8UnormSrgb).await?;
        Ok(())
    })
}
