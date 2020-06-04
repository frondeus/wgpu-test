#version 450

const int MAX_MARCHING_STEPS = 255;
const float MIN_DIST = 0.0;
const float MAX_DIST = 100.0;
const float EPSILON = 0.0001;

layout(location = 0) in vec2 fragCoord;
layout(location = 0) out vec4 outColor;
layout(set = 0, binding = 0) uniform Uniforms {
    float aspectRatio;
    float FOV;
    mat4 view;
    vec3 eye;
};

float sphereSDF(vec3 point) {
    return length(point) - 1.0;
}

float cubeSDF(vec3 point) {
    vec3 d = abs(point) - vec3(1.0);

    float insideDistance = min(max(d.x, max(d.y, d.z)), 0.0);
    float outsideDistance = length(max(d, 0.0));

    return insideDistance + outsideDistance;
}

float sceneSDF(vec3 point) {
    float sphere = sphereSDF(point / 1.2) * 1.2;
    float cube = cubeSDF(point);

    return max(sphere, cube);
}


// Technical stuff:

vec3 estimateNormal(vec3 p) {
    return normalize(vec3(
        sceneSDF(vec3(p.x + EPSILON, p.y, p.z)) - sceneSDF(vec3(p.x - EPSILON, p.y, p.z)),
        sceneSDF(vec3(p.x, p.y + EPSILON, p.z)) - sceneSDF(vec3(p.x, p.y - EPSILON, p.z)),
        sceneSDF(vec3(p.x, p.y, p.z + EPSILON)) - sceneSDF(vec3(p.x, p.y, p.z - EPSILON))
    ));
}

float shortestDist(vec3 eye, vec3 marchingDirection, float start, float end) {
    float depth = start;
    for (int i = 0; i < MAX_MARCHING_STEPS; i++) {
        float dist = sceneSDF(eye + depth * marchingDirection);
        if (dist < EPSILON) { return depth; }
        depth += dist;
        if (depth >= end) { return end; }
    }
    return end;
}

vec3 rayDirection(float FOV, vec2 size, vec2 fragCoord) {
    vec2 xy = fragCoord - size / 2.0;
    float z = size.y / tan(radians(FOV) / 2.0);
    return normalize(vec3(xy, -z));
}

vec3 phongContrib(vec3 k_d, vec3 k_s, float alpha, vec3 p, vec3 eye, vec3 lightPos, vec3 lightIntensity) {
    vec3 N = estimateNormal(p);
    vec3 L = normalize(lightPos - p);
    vec3 V = normalize(eye - p);
    vec3 R = normalize(reflect(-L, N));

    float dotLN = dot(L, N);
    float dotRV = dot(R, V);

    if (dotLN < 0.0) {
        return vec3(0);
    }
    if (dotRV < 0.0) {
        return lightIntensity * (k_d * dotLN);
    }
    return lightIntensity * (k_d * dotLN + k_s * pow(dotRV, alpha));
}

//k_a - ambient
//k_d - diffuse
//k_s - specular
//alpha - shininess coefficient
//p - position
//eye - camera
vec3 phong(vec3 k_a, vec3 k_d, vec3 k_s, float alpha, vec3 p, vec3 eye) {
    const vec3 ambient = 0.5 * vec3(1.0, 1.0, 1.0);
    vec3 color = ambient * k_a;

    vec3 light1Pos = vec3(4.0, 2.0, 4.0);
    vec3 light1Intensity = vec3(0.2, 0.4, 0.2);

    color += phongContrib(k_d, k_s, alpha, p, eye, light1Pos, light1Intensity);

    vec3 light2Pos = vec3(2.0, 2.0, 2.0);
    vec3 light2Intensity = vec3(0.2, 0.4, 0.2);

    color += phongContrib(k_d, k_s, alpha, p, eye, light2Pos, light2Intensity);

    return color;
}

vec3 fog (in vec3 rgb, in float distance, in vec3 rayDir, in vec3 sunDir) {
    float b = 0.01;
    float fogAmount = 1.0 - exp(-distance * b);
    float sunAmount = max(dot(rayDir, sunDir), 0.0);
    vec3 fogColor = mix(vec3(0.5, 0.6, 0.7),
                        vec3(1.0, 0.9, 0.7),
                        pow(sunAmount, 8.0));
    return mix(rgb, fogColor, fogAmount);
}

mat3 viewMatrix(vec3 eye, vec3 center, vec3 up) {
    vec3 f = normalize(center - eye);
    vec3 s = normalize(cross(f, up));
    vec3 u = cross(s, f);
    return mat3(s, u , -f);
}

void main() {
    vec2 res = vec2(aspectRatio, 1);

    vec3 cameraDir = rayDirection(FOV, res, fragCoord);

    //vec3 eye = vec3(8.0, 5.0, 7.0);
    mat3 view = viewMatrix(eye, vec3(0), vec3(0, -1, 0));

    vec3 dir = view * cameraDir;

    float dist = shortestDist(eye, dir, MIN_DIST, MAX_DIST);

    if (dist > MAX_DIST - EPSILON) {
        outColor = vec4(vec3(0.0), 1.0);
        return;
    }

    vec3 p = eye + dist * dir;
    vec3 K_a = vec3(0.2, 0.2, 0.2);
    vec3 K_d = vec3(0.7, 0.2, 0.2);
    vec3 K_s = vec3(1.0);
    float shininess = 10.0;

    vec3 color = phong(K_a, K_d, K_s, shininess, p, eye);

    color = fog(color, dist, dir, vec3(4, 2, 4));

    outColor = vec4(color, 1.0);
}
