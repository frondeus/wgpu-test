#version 450

layout(location = 0) out vec2 fragCoord;
layout(set = 0, binding = 0) uniform Globals {
    vec2 aspectRatio; //viewport res
};

const vec2 quad[6] = vec2[6] (
    vec2(-1.0, -1.0),
    vec2(-1.0, 1.0),
    vec2(1.0, 1.0),
    vec2(-1.0, -1.0),
    vec2(1.0, 1.0),
    vec2(1.0, -1.0)
);

const vec2 tex[6] = vec2[6] (
    vec2(0, 1),
    vec2(0, 0),
    vec2(1, 0),
    vec2(0, 1),
    vec2(1, 0),
    vec2(1, 1)
);

void main() {
    vec2 position = quad[gl_VertexIndex];
    float ratio = 8.0/6.0;

    fragCoord = tex[gl_VertexIndex];
    fragCoord.x *= ratio;
    gl_Position = vec4(position, 0.0, 1.0);
}