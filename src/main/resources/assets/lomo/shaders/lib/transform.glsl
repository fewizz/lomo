#include frex:shaders/api/view.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:lib/transform.frag */

vec2 window_to_ndc(vec2 w) {
    return (w / frxu_size) * 2 - 1;
}

vec2 ndc_to_window(vec2 w) {
    return ((w + 1) / 2) * frxu_size;
}

float z_window_to_ndc(float zw) {
    //float n = gl_DepthRange.near;
    //float f = gl_DepthRange.far;

    return zw * 2 - 1;//(zw - (n + f)/2) / ((f - n)/2);
}

float z_ndc_to_window(float zd) {
    //float n = gl_DepthRange.near;
    //float f = gl_DepthRange.far;

    return (zd + 1) / 2;//((f - n)/2)*zd + (n + f)/2;
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

vec3 world_to_window(vec3 w, mat4 m) {
    //vec4 clip = m*vec4(w, 1);
    float xc = w.x * m[0][0] + w.z * m[2][0];
    float yc = w.y * m[1][1] + w.z * m[2][1];
    float zc = w.z * m[2][2] + m[3][2];
    vec3 ndc = vec3(xc, yc, zc)/(-w.z);//vec4( ).xyz;

    return vec3(ndc_to_window(ndc.xy), z_ndc_to_window(ndc.z));
}