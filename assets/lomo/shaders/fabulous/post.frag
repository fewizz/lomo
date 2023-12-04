#include frex:shaders/api/view.glsl

#include lomo:shaders/sky.glsl

uniform sampler2D u_blended_color;
uniform sampler2D u_blended_depth;

layout(location = 0) out vec3 out_color;

void main() {
	float depth0 = texelFetch(u_blended_depth, ivec2(gl_FragCoord.xy), 0).x;
	vec3 pos = vec3(gl_FragCoord.xy, depth0);
	vec3 pos_cam0 = win_to_cam(pos);

	vec3 ndc_near = vec3(gl_FragCoord.xy, 0.0) / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;
	vec3 ndc_far  = vec3(gl_FragCoord.xy, 1.0) / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;

	vec4 near0 = frx_inverseProjectionMatrix * vec4(ndc_near, 1.0);
	vec4 far0  = frx_inverseProjectionMatrix * vec4(ndc_far, 1.0);
	vec3 near = near0.xyz / near0.w;
	vec3 far  = far0.xyz  / far0.w;

	vec3 dir = normalize(far - near);

	float off = 0.5;//hash33(vec3(gl_FragCoord.xy, frx_renderSeconds)).x;

	out_color =
		depth0 >= 1.0 ?
		sky(mat3(frx_inverseViewMatrix) * dir, off) :
		texelFetch(u_blended_color, ivec2(gl_FragCoord.xy), 0).rgb;

	//out_color = pow(out_color, vec3(1.0 / 2.2));
}