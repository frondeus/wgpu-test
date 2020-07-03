#version 450

const int MAX_MARCHING_STEPS = 255;
const float MIN_DIST = 0.0;
const float MAX_DIST = 250.0;
const float EPSILON = 0.0001;

layout(location = 0) in vec2 fragCoord;
layout(location = 0) out vec4 outColor;
layout(set = 0, binding = 0) uniform UniformData {
    mat4 view;
    vec4 eye;
    vec2 camera; //x = aspectRatio, y = FOV
};


float sphereSDF(vec3 point) {
    return length(point) - 1.0;
}

float planeSDF(vec3 point) {
    return abs(point.y);
}

float gridSDF(vec3 point) {
    float l = 0.01;
    vec3 c = vec3(1.0, 0.0, 1.0);
    vec3 q = mod(point + 0.5 * c, c) - 0.5 * c;

    float w = min(abs(q.x), abs(q.z)) - l;
    return max(planeSDF(point), w);
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

    float obj = max(sphere, cube);
    float grid = gridSDF(point);
    //float plane = planeSDF(point);

    return min(obj, grid);
    //return min(obj, plane);
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
    vec3 light1Intensity = vec3(1.2, 1.4, 1.2);

    color += phongContrib(k_d, k_s, alpha, p, eye, light1Pos, light1Intensity);

    //vec3 light2Pos = vec3(2.0, 2.0, 2.0);
    //vec3 light2Intensity = vec3(0.2, 0.4, 0.2);

    //color += phongContrib(k_d, k_s, alpha, p, eye, light2Pos, light2Intensity);

    return color;
}

vec3 rayDirection(float FOV, vec2 size, vec2 fragCoord) {
    vec2 xy = fragCoord - size / 2.0;
    float z = size.y / tan(radians(FOV) / 2.0);
    return normalize(vec3(xy, -z));
}


void main() {
    float aspectRatio = camera.x;
    float FOV = camera.y;
    vec2 res = vec2(aspectRatio, 1);

    vec3 cameraDir = rayDirection(FOV, res, fragCoord);
    vec3 dir = (view * vec4(cameraDir, 1.0)).xyz;

    float dist = shortestDist(eye.xyz, dir, MIN_DIST, MAX_DIST);

    vec3 color;

    vec3 light1 = normalize(vec3(-3.0, 2.0, -4.0));
    float sundot = clamp(dot(dir,light1),0.0,1.0);

    float MAX = MAX_DIST - EPSILON;
    if (dist > MAX) {
        // Sky
        vec3 horizonColor = vec3(32.0/256.0, 48.0/256.0, 96.0/256.0);
        vec3 skyColor = vec3(248.0/256.0, 192.0/256.0, 216.0/256.0);

        color = 2 * mix(horizonColor, skyColor,  (dir.y  - 1.0) * 0.25 );

        //Sun
        //color += 0.25*vec3(1.0,0.7,0.4)*pow( sundot,5.0 );
        //color += 0.25*vec3(1.0,0.8,0.6)*pow( sundot,64.0 );
        //color += 0.2*vec3(1.0,0.8,0.6)*pow( sundot,512.0 );
        //color += 0.2*vec3(1.0,0.8,0.6)*pow( sundot,1024.0 );
        color += min(1.0, pow(sundot, 1000));

        // Horizon
        color = mix( color, 0.68 * vec3(0.1, 0.1, 0.20), pow( 1.0 - max(dir.y, 0.0), 16.0 ) );
    } else {
        color = vec3(0.2);

	vec3 p = eye.xyz + dist * dir;
	vec3 K_a = vec3(0.2, 0.2, 0.2);
	vec3 K_d = vec3(0.7, 0.2, 0.2);
	vec3 K_s = vec3(1.0);
	float shininess = 10.0;

	color = phong(K_a, K_d, K_s, shininess, p, eye.xyz);

        float fo = 1.0-exp(-pow(0.001*dist/250.0,1.5) );
        vec3 fco = 0.65*vec3(0.4,0.65,1.0)  + 0.1*vec3(1.0,0.8,0.5)*pow( sundot, 4.0 );

        color = mix( color, fco, fo );
    }

    // Atmosphere scattering
    color += 0.3*vec3(0.2,0.2,0.4)*pow( sundot, 8.0 );

    // Gamma correction
    color = pow(color, vec3(2.2));
    outColor = vec4(color, 1.0);
}
