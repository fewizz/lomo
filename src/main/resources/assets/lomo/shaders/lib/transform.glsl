#include frex:shaders/api/view.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:lib/transform.frag */

vec2 window_to_ndc(vec2 w) {
    return (w / frxu_size) * 2 - 1;
}

float z_window_to_ndc(float zw) {
    float n = gl_DepthRange.near;
    float f = gl_DepthRange.far;

    return (zw - (n + f)/2) / ((f - n)/2);
}

float z_window_to_world(float zw, mat4 m) {
    float zd = z_window_to_ndc(zw);
    return -m[3][2] / (m[2][2] + zd);
}

vec3 window_to_world(vec3 w, mat4 m) {
    vec2 ndc = vec2(window_to_ndc(w.xy));

    float z = z_window_to_world(w.z, m);
    float x = (-z * (ndc.x + m[2][0])) / m[0][0];
    float y = (-z * (ndc.y + m[2][1])) / m[1][1];

    return vec3(x, y, z);
}